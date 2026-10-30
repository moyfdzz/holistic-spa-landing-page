// @vitest-environment node
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { searchConsoleDaily, searchConsoleTotals } from "../db/schema.js";
import { TOKEN_URL } from "./auth.js";
import {
  MAX_DAYS_PER_RUN,
  planDays,
  runSearchConsoleImport,
  SEARCH_CONSOLE_START_DAY,
} from "./import.js";
import { importedRange } from "./store.js";

const migrationsFolder = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);

describe("planDays", () => {
  const plan = (/** @type {Parameters<typeof planDays>[0]} */ input) =>
    planDays(input);

  it("asks for the three newest days on a first run, then the history, newest first", () => {
    expect(
      plan({ lastAvailable: "2026-10-28", earliest: null, latest: null }),
    ).toEqual([
      "2026-10-28",
      "2026-10-27",
      "2026-10-26",
      "2026-10-25",
      "2026-10-24",
      "2026-10-23",
      "2026-10-22",
      "2026-10-21",
      "2026-10-20",
    ]);
  });

  it("never asks for more days than a run can afford", () => {
    const days = plan({
      lastAvailable: "2027-03-01",
      earliest: null,
      latest: null,
    });
    expect(days).toHaveLength(MAX_DAYS_PER_RUN);
  });

  it("keeps filling the history from the oldest day already imported", () => {
    const days = plan({
      lastAvailable: "2026-10-29",
      earliest: "2026-10-20",
      latest: "2026-10-28",
    });
    expect(days.slice(0, 3)).toEqual([
      "2026-10-29",
      "2026-10-28",
      "2026-10-27",
    ]);
    expect(days.slice(3)).toEqual([
      "2026-10-19",
      "2026-10-18",
      "2026-10-17",
      "2026-10-16",
      "2026-10-15",
      "2026-10-14",
    ]);
  });

  it("stops at the first day with data", () => {
    const days = plan({
      lastAvailable: "2026-11-05",
      earliest: "2026-10-13",
      latest: "2026-11-04",
    });
    expect(days.slice(3)).toEqual(["2026-10-12", SEARCH_CONSOLE_START_DAY]);
    expect(days.every((day) => day >= SEARCH_CONSOLE_START_DAY)).toBe(true);
  });

  it("only asks for the recent days once the history is complete", () => {
    expect(
      plan({
        lastAvailable: "2026-11-05",
        earliest: SEARCH_CONSOLE_START_DAY,
        latest: "2026-11-04",
      }),
    ).toEqual(["2026-11-05", "2026-11-04", "2026-11-03"]);
  });

  it("fills the days of a run that was missed, before the old history", () => {
    const days = plan({
      lastAvailable: "2026-11-10",
      earliest: SEARCH_CONSOLE_START_DAY,
      latest: "2026-11-02",
    });
    expect(days).toEqual([
      "2026-11-10",
      "2026-11-09",
      "2026-11-08",
      "2026-11-07",
      "2026-11-06",
      "2026-11-05",
      "2026-11-04",
      "2026-11-03",
    ]);
  });

  it("never asks for a day before the property had data", () => {
    expect(
      plan({ lastAvailable: "2026-10-12", earliest: null, latest: null }),
    ).toEqual(["2026-10-12", SEARCH_CONSOLE_START_DAY]);
    expect(
      plan({ lastAvailable: "2026-10-10", earliest: null, latest: null }),
    ).toEqual([]);
  });
});

/**
 * Builds a `fetch` that plays Google: the token address and the Search Analytics query.
 * @param {Record<string, Array<{ keys: string[], clicks: number, impressions: number, ctr: number, position: number }>>} [byDay] - The details of each day.
 * @returns {{ fetchFn: typeof fetch, calls: Array<{ url: string, body: Record<string, unknown> }> }} The fake and what it was asked.
 */
function fakeGoogle(byDay = {}) {
  /** @type {Array<{ url: string, body: Record<string, unknown> }>} */
  const calls = [];
  const fetchFn = vi.fn(
    async (/** @type {string} */ url, /** @type {RequestInit} */ init) => {
      if (url === TOKEN_URL) {
        calls.push({ url, body: {} });
        return Response.json({ access_token: "token-de-prueba" });
      }
      const body = JSON.parse(String(init.body));
      calls.push({ url, body });
      const rows = byDay[body.startDate] ?? [];
      if (body.dimensions.length === 1) {
        const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
        const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
        return Response.json(
          rows.length === 0
            ? {}
            : {
                rows: [
                  {
                    keys: [body.startDate],
                    clicks,
                    impressions,
                    ctr: clicks / impressions,
                    position: 6,
                  },
                ],
              },
        );
      }
      return Response.json(rows.length === 0 ? {} : { rows });
    },
  );
  return {
    fetchFn: /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchFn)),
    calls,
  };
}

const row = (/** @type {string} */ query, clicks = 1, impressions = 10) => ({
  keys: [query, "https://www.masajesrelaxmty.com/", "mex", "MOBILE"],
  clicks,
  impressions,
  ctr: clicks / impressions,
  position: 6,
});

/** A configuration made for the tests. */
const config = /** @type {import("./config.js").SearchConsoleConfig} */ ({
  configured: true,
  siteUrl: "sc-domain:masajesrelaxmty.com",
  account: {
    client_email: "reader@example.iam.gserviceaccount.com",
    private_key: "unused",
  },
});

describe("runSearchConsoleImport (in-memory Postgres)", () => {
  const db = drizzle(new PGlite());

  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
  });

  beforeEach(async () => {
    await db.delete(searchConsoleDaily);
    await db.delete(searchConsoleTotals);
  });

  /**
   * Runs the import with Google replaced by the fake. The sign-in is a request to the token
   * address, so it is counted like Google would count it.
   * @param {Date} now - The current time.
   * @param {ReturnType<typeof fakeGoogle>} google - The fake Google.
   * @returns {Promise<import("./import.js").ImportSummary>} The summary.
   */
  const run = (now, google) =>
    runSearchConsoleImport({
      db,
      config,
      now,
      fetchFn: google.fetchFn,
      sleep: async () => {},
      tokenFn: async () => {
        await google.fetchFn(TOKEN_URL, { method: "POST" });
        return "token-de-prueba";
      },
    });

  it("does nothing, and says why, when the settings are not there", async () => {
    const google = fakeGoogle();
    const summary = await runSearchConsoleImport({
      db,
      config: { configured: false, missing: ["GOOGLE_SERVICE_ACCOUNT_JSON"] },
      now: new Date("2026-10-30T07:30:00Z"),
      fetchFn: google.fetchFn,
    });
    expect(summary).toMatchObject({ skipped: true, days: 0 });
    expect(summary.reason).toContain("GOOGLE_SERVICE_ACCOUNT_JSON");
    expect(google.calls).toEqual([]);
  });

  it("does nothing before the first day with data", async () => {
    const google = fakeGoogle();
    const summary = await run(new Date("2026-10-12T07:30:00Z"), google);
    expect(summary).toMatchObject({ skipped: true, reason: "no data yet" });
    expect(await importedRange(db)).toEqual({ earliest: null, latest: null });
  });

  it("imports the recent days and part of the history on the first run", async () => {
    const google = fakeGoogle({
      "2026-10-28": [
        row("masajes monterrey", 3, 30),
        row("masaje a domicilio", 1, 20),
      ],
      "2026-10-27": [row("masajes monterrey", 2, 25)],
      "2026-10-22": [row("masaje relajante")],
    });
    const summary = await run(new Date("2026-10-30T07:30:00Z"), google);
    expect(summary).toEqual({
      skipped: false,
      days: 9,
      rows: 4,
      from: "2026-10-20",
      to: "2026-10-28",
    });
    expect(await importedRange(db)).toEqual({
      earliest: "2026-10-20",
      latest: "2026-10-28",
    });
    const [day] = await db
      .select()
      .from(searchConsoleTotals)
      .where(
        (await import("drizzle-orm")).eq(searchConsoleTotals.day, "2026-10-28"),
      );
    expect(day).toMatchObject({ clicks: 4, impressions: 50 });
  });

  it("asks for each day once for the totals and once for the details, with one sign-in", async () => {
    const google = fakeGoogle();
    await run(new Date("2026-10-30T07:30:00Z"), google);
    const tokenCalls = google.calls.filter((call) => call.url === TOKEN_URL);
    const queries = google.calls.filter((call) => call.url !== TOKEN_URL);
    expect(tokenCalls).toHaveLength(1);
    expect(queries).toHaveLength(9 * 2);
    // Within the 50 requests a Worker on the free plan may make, with the database ones.
    expect(tokenCalls.length + queries.length + 9 + 1).toBeLessThanOrEqual(50);
  });

  it("finishes the history in a few nights and then only keeps the recent days fresh", async () => {
    const google = fakeGoogle();
    await run(new Date("2026-10-30T07:30:00Z"), google);
    await run(new Date("2026-10-31T07:30:00Z"), google);
    const third = await run(new Date("2026-11-01T07:30:00Z"), google);
    expect((await importedRange(db)).earliest).toBe(SEARCH_CONSOLE_START_DAY);
    expect(third.days).toBeLessThan(9);
    const fourth = await run(new Date("2026-11-02T07:30:00Z"), google);
    expect(fourth).toMatchObject({
      days: 3,
      from: "2026-10-29",
      to: "2026-10-31",
    });
  });

  it("gives the same rows when the same days are imported again", async () => {
    const google = fakeGoogle({
      "2026-10-28": [row("masajes monterrey", 3, 30)],
    });
    const now = new Date("2026-10-30T07:30:00Z");
    await run(now, google);
    const before = await db.select().from(searchConsoleDaily);
    await run(now, google);
    expect(await db.select().from(searchConsoleDaily)).toEqual(before);
  });

  it("keeps the days it finished when a later one fails, and says what failed", async () => {
    /** @type {number} */
    let queries = 0;
    const fetchFn = /** @type {typeof fetch} */ (
      /** @type {unknown} */ (
        vi.fn(async (/** @type {string} */ url) => {
          if (url === TOKEN_URL)
            return Response.json({ access_token: "token-de-prueba" });
          queries += 1;
          // Days 1 and 2 (four requests) work; the third day's totals fail for good.
          return queries <= 4
            ? Response.json({})
            : new Response("{}", { status: 403 });
        })
      )
    );
    await expect(
      runSearchConsoleImport({
        db,
        config,
        now: new Date("2026-10-30T07:30:00Z"),
        fetchFn,
        sleep: async () => {},
        tokenFn: async () => "token-de-prueba",
      }),
    ).rejects.toThrow("Search Console API answered 403");
    const range = await importedRange(db);
    expect(range).toEqual({ earliest: "2026-10-27", latest: "2026-10-28" });
  });
});
