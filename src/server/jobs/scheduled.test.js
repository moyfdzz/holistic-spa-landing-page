// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../db/client.js", () => ({ createDb: vi.fn(() => ({ fake: "db" })) }));
vi.mock("../analytics/jobs.js", () => ({ runDailyJob: vi.fn() }));
vi.mock("../google/import.js", () => ({ runSearchConsoleImport: vi.fn() }));

const { runDailyJob } = await import("../analytics/jobs.js");
const { runSearchConsoleImport } = await import("../google/import.js");
const { runScheduled } = await import("./scheduled.js");
const { SafeError } = await import("../errors.js");

const daily = vi.mocked(runDailyJob);
const google = vi.mocked(runSearchConsoleImport);

// A connection string made up for the tests: nothing real.
const env = { DATABASE_URL: "postgres://usuario:clave@localhost/prueba" };
const controller = { scheduledTime: Date.parse("2026-10-30T07:30:00Z") };

describe("runScheduled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    daily.mockResolvedValue({ days: {}, saltsDeleted: 0, eventsDeleted: 0 });
    google.mockResolvedValue({
      skipped: true,
      days: 0,
      rows: 0,
      from: null,
      to: null,
    });
  });

  it("runs the daily job and the Google import with the time of the schedule", async () => {
    await runScheduled(controller, env);
    expect(daily).toHaveBeenCalledWith(
      { fake: "db" },
      new Date("2026-10-30T07:30:00Z"),
    );
    expect(google).toHaveBeenCalledWith(
      expect.objectContaining({
        db: { fake: "db" },
        now: new Date("2026-10-30T07:30:00Z"),
      }),
    );
  });

  it("leaves the import out, without failing, when Google is not configured", async () => {
    await runScheduled(controller, env);
    const input = google.mock.calls[0][0];
    expect(input.config).toMatchObject({ configured: false });
  });

  it("gives the import its settings when they are there", async () => {
    const key = JSON.stringify({
      client_email: "reader@example.iam.gserviceaccount.com",
      private_key:
        "-----BEGIN PRIVATE KEY-----\nQUJD\n-----END PRIVATE KEY-----\n",
    });
    await runScheduled(controller, {
      ...env,
      GOOGLE_SERVICE_ACCOUNT_JSON: key,
      SEARCH_CONSOLE_SITE_URL: "sc-domain:masajesrelaxmty.com",
    });
    expect(google.mock.calls[0][0].config).toMatchObject({
      configured: true,
      siteUrl: "sc-domain:masajesrelaxmty.com",
    });
  });

  it("logs why the Google import failed when the reason is safe, and nothing else", async () => {
    google.mockRejectedValueOnce(
      new SafeError("Search Console API answered 403 (PERMISSION_DENIED)"),
    );
    await expect(runScheduled(controller, env)).rejects.toThrow("403");
    expect(console.error).toHaveBeenCalledWith(
      "search console import failed:",
      "SafeError: Search Console API answered 403 (PERMISSION_DENIED)",
    );
    google.mockRejectedValueOnce(new Error("https://host.example/?k=TU_CLAVE"));
    await expect(runScheduled(controller, env)).rejects.toThrow();
    expect(console.error).toHaveBeenLastCalledWith(
      "search console import failed:",
      "Error",
    );
  });

  it("still runs the daily job, which deletes what must not be kept, when Google fails", async () => {
    google.mockRejectedValue(new Error("Search Console API answered 403"));
    await expect(runScheduled(controller, env)).rejects.toThrow("403");
    expect(daily).toHaveBeenCalledTimes(1);
  });

  it("still imports Google when the daily job fails, and the run is marked as failed", async () => {
    daily.mockRejectedValue(new Error("daily broke"));
    await expect(runScheduled(controller, env)).rejects.toThrow("daily broke");
    expect(google).toHaveBeenCalledTimes(1);
  });

  it("fails with the first problem when both fail", async () => {
    daily.mockRejectedValue(new Error("daily broke"));
    google.mockRejectedValue(new Error("google broke"));
    await expect(runScheduled(controller, env)).rejects.toThrow("daily broke");
  });

  it("logs counts only, and never the connection string", async () => {
    daily.mockRejectedValue(new Error("daily broke"));
    await expect(runScheduled(controller, env)).rejects.toThrow();
    const logged = JSON.stringify([
      ...vi.mocked(console.log).mock.calls,
      ...vi.mocked(console.error).mock.calls,
    ]);
    expect(logged).toContain("search console import finished");
    expect(logged).not.toContain("clave");
    expect(logged).not.toContain("postgres://");
  });

  it("does not try the import without a database, and fails", async () => {
    await expect(runScheduled(controller, {})).rejects.toThrow("DATABASE_URL");
    expect(google).not.toHaveBeenCalled();
  });
});
