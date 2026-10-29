// @vitest-environment node
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, describe, expect, it } from "vitest";
import { analyticsEvents } from "../db/schema.js";
import { buildEventRow } from "./collect.js";
import { getDailySalt, insertEvent } from "./store.js";

const migrationsFolder = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);

describe("analytics store (in-memory Postgres)", () => {
  const db = drizzle(new PGlite());

  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
  });

  it("keeps one salt per day and a different one on another day", async () => {
    const first = await getDailySalt(db, "2026-10-29");
    expect(await getDailySalt(db, "2026-10-29")).toBe(first);
    expect(await getDailySalt(db, "2026-10-30")).not.toBe(first);
  });

  it("stores an event without the IP address or the user agent", async () => {
    const result = await buildEventRow({
      body: { type: "page_view", path: "/", locale: "es" },
      headers: new Headers({
        origin: "https://www.masajesrelaxmty.com",
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        "cf-connecting-ip": "198.51.100.23",
      }),
      cf: { country: "MX", city: "Monterrey" },
      siteHost: "www.masajesrelaxmty.com",
      getSalt: () => getDailySalt(db, "2026-10-29"),
      now: new Date("2026-10-29T12:00:00Z"),
    });
    if (!("row" in result)) throw new Error("dropped");
    await insertEvent(db, result.row);

    const rows = await db.select().from(analyticsEvents);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: "page_view",
      channel: "direct",
      device: "mobile",
      browser: "Safari",
      os: "iOS",
      country: "MX",
      city: "Monterrey",
    });
    expect(JSON.stringify(rows[0])).not.toContain("198.51.100.23");
    expect(JSON.stringify(rows[0])).not.toContain("Mozilla");
  });
});
