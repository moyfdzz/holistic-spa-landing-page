// @vitest-environment node
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  analyticsDaily,
  analyticsDistributions,
  analyticsEvents,
  analyticsSalts,
} from "../db/schema.js";
import {
  purgeOldEvents,
  purgeOldSalts,
  rollupDay,
  runDailyJob,
} from "./jobs.js";

const migrationsFolder = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);

/**
 * @param {string} iso - When it happened, in UTC.
 * @param {Partial<typeof analyticsEvents.$inferInsert>} [override] - What to change.
 * @returns {typeof analyticsEvents.$inferInsert} A row to insert.
 */
function row(iso, override = {}) {
  return {
    occurredAt: new Date(iso),
    visitorId: "v1",
    type: "page_view",
    path: "/",
    locale: "es",
    channel: "direct",
    device: "desktop",
    browser: "Chrome",
    os: "Windows",
    screen: "large",
    ...override,
  };
}

describe("daily job (in-memory Postgres)", () => {
  const db = drizzle(new PGlite());

  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
  });

  beforeEach(async () => {
    await db.delete(analyticsEvents);
    await db.delete(analyticsDaily);
    await db.delete(analyticsDistributions);
    await db.delete(analyticsSalts);
  });

  it("rolls up one Monterrey day, not one UTC day", async () => {
    await db.insert(analyticsEvents).values([
      // 23:30 on 29 Oct in Monterrey is 05:30 UTC on the 30th: belongs to the 29th.
      row("2026-10-30T05:30:00Z", { visitorId: "late" }),
      // 00:30 on the 30th in Monterrey is 06:30 UTC: belongs to the 30th.
      row("2026-10-30T06:30:00Z", { visitorId: "next" }),
      // 00:30 on 29 Oct in Monterrey is 06:30 UTC on the 29th: belongs to the 29th.
      row("2026-10-29T06:30:00Z", { visitorId: "early" }),
    ]);
    await rollupDay(db, "2026-10-29");
    const [total] = await db
      .select()
      .from(analyticsDaily)
      .where(sql`${analyticsDaily.dimension} = 'total'`);
    expect(total).toMatchObject({
      day: "2026-10-29",
      visitors: 2,
      pageViews: 2,
    });
  });

  it("gives the same result when run twice and replaces the old numbers", async () => {
    await db.insert(analyticsEvents).values([row("2026-10-29T16:00:00Z")]);
    await rollupDay(db, "2026-10-29");
    const first = await db
      .select()
      .from(analyticsDaily)
      .orderBy(analyticsDaily.dimension, analyticsDaily.key);
    await db
      .insert(analyticsEvents)
      .values([row("2026-10-29T17:00:00Z", { visitorId: "v2" })]);
    await rollupDay(db, "2026-10-29");
    await rollupDay(db, "2026-10-29");
    const second = await db.select().from(analyticsDaily);
    const totals = second.filter((r) => r.dimension === "total");
    expect(totals).toHaveLength(1);
    expect(totals[0]).toMatchObject({ visitors: 2, pageViews: 2 });
    expect(first.find((r) => r.dimension === "total")?.visitors).toBe(1);
  });

  it("removes rows that are no longer in the day", async () => {
    await db
      .insert(analyticsEvents)
      .values([row("2026-10-29T16:00:00Z", { channel: "instagram" })]);
    await rollupDay(db, "2026-10-29");
    await db.delete(analyticsEvents);
    await db
      .insert(analyticsEvents)
      .values([row("2026-10-29T16:00:00Z", { channel: "bing" })]);
    await rollupDay(db, "2026-10-29");
    const channels = await db
      .select()
      .from(analyticsDaily)
      .where(sql`${analyticsDaily.dimension} = 'channel'`);
    expect(channels.map((r) => r.key)).toEqual(["bing"]);
  });

  describe("histograms", () => {
    /**
     * @param {string} iso - When it happened, in UTC.
     * @param {number} seconds - Seconds of active time.
     * @param {Partial<typeof analyticsEvents.$inferInsert>} [override] - What to change.
     * @returns {typeof analyticsEvents.$inferInsert} An engagement event.
     */
    const engagement = (iso, seconds, override = {}) =>
      row(iso, {
        type: "engagement",
        props: { seconds, scroll: 50 },
        ...override,
      });

    it("stores the active time of the sessions of the day", async () => {
      await db
        .insert(analyticsEvents)
        .values([
          row("2026-10-29T16:00:00Z"),
          engagement("2026-10-29T16:01:00Z", 12),
          row("2026-10-29T17:00:00Z", { visitorId: "v2" }),
          engagement("2026-10-29T17:01:00Z", 200, { visitorId: "v2" }),
        ]);
      await rollupDay(db, "2026-10-29");
      const rows = await db.select().from(analyticsDistributions);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        day: "2026-10-29",
        metric: "engaged_seconds",
        samples: 2,
      });
      expect(rows[0].buckets).toHaveLength(13);
    });

    it("gives the same histograms when run twice and replaces the old ones", async () => {
      await db
        .insert(analyticsEvents)
        .values([
          row("2026-10-29T16:00:00Z"),
          engagement("2026-10-29T16:01:00Z", 12),
        ]);
      await rollupDay(db, "2026-10-29");
      const first = await db.select().from(analyticsDistributions);
      await rollupDay(db, "2026-10-29");
      expect(await db.select().from(analyticsDistributions)).toEqual(first);
      await db
        .insert(analyticsEvents)
        .values([
          row("2026-10-29T18:00:00Z", { visitorId: "v3" }),
          engagement("2026-10-29T18:01:00Z", 90, { visitorId: "v3" }),
        ]);
      await rollupDay(db, "2026-10-29");
      const [after] = await db.select().from(analyticsDistributions);
      expect(after.samples).toBe(2);
    });

    it("removes the histograms of a day that no longer has measures", async () => {
      await db.insert(analyticsDistributions).values({
        day: "2026-10-29",
        metric: "engaged_seconds",
        samples: 1,
        buckets: [1],
      });
      await rollupDay(db, "2026-10-29");
      expect(await db.select().from(analyticsDistributions)).toEqual([]);
    });

    it("leaves the histograms of other days alone", async () => {
      await db.insert(analyticsDistributions).values({
        day: "2026-10-28",
        metric: "engaged_seconds",
        samples: 1,
        buckets: [1],
      });
      await rollupDay(db, "2026-10-29");
      expect(await db.select().from(analyticsDistributions)).toHaveLength(1);
    });

    it("keeps the histograms when the raw events are deleted", async () => {
      await db
        .insert(analyticsEvents)
        .values([
          row("2026-10-29T16:00:00Z"),
          engagement("2026-10-29T16:01:00Z", 12),
        ]);
      await rollupDay(db, "2026-10-29");
      await purgeOldEvents(db, new Date("2028-01-01T00:00:00Z"));
      expect(await db.select().from(analyticsDistributions)).toHaveLength(1);
    });
  });

  it("leaves other days alone", async () => {
    await db.insert(analyticsEvents).values([row("2026-10-28T16:00:00Z")]);
    await rollupDay(db, "2026-10-28");
    await rollupDay(db, "2026-10-29");
    const days = await db
      .select()
      .from(analyticsDaily)
      .where(sql`${analyticsDaily.dimension} = 'total'`);
    expect(days.map((d) => `${d.day}:${d.visitors}`).sort()).toEqual([
      "2026-10-28:1",
      "2026-10-29:0",
    ]);
  });

  it("deletes the salts of earlier days and keeps today's", async () => {
    await db.insert(analyticsSalts).values([
      { day: "2026-10-27", salt: "a" },
      { day: "2026-10-28", salt: "b" },
      { day: "2026-10-29", salt: "c" },
    ]);
    expect(await purgeOldSalts(db, "2026-10-29")).toBe(2);
    expect((await db.select().from(analyticsSalts)).map((s) => s.day)).toEqual([
      "2026-10-29",
    ]);
  });

  it("deletes raw events older than 13 months and keeps the rest", async () => {
    await db
      .insert(analyticsEvents)
      .values([
        row("2025-09-20T12:00:00Z", { visitorId: "old" }),
        row("2025-09-30T12:00:00Z", { visitorId: "just-inside" }),
        row("2026-10-01T12:00:00Z", { visitorId: "recent" }),
      ]);
    const deleted = await purgeOldEvents(db, new Date("2026-10-29T12:00:00Z"));
    expect(deleted).toBe(1);
    const left = await db.select().from(analyticsEvents);
    expect(left.map((e) => e.visitorId).sort()).toEqual([
      "just-inside",
      "recent",
    ]);
  });

  it("keeps the daily totals when the raw events are deleted", async () => {
    await db.insert(analyticsEvents).values([row("2025-08-10T16:00:00Z")]);
    await rollupDay(db, "2025-08-10");
    await purgeOldEvents(db, new Date("2026-10-29T12:00:00Z"));
    expect(await db.select().from(analyticsEvents)).toHaveLength(0);
    const totals = await db
      .select()
      .from(analyticsDaily)
      .where(sql`${analyticsDaily.dimension} = 'total'`);
    expect(totals[0]).toMatchObject({ day: "2025-08-10", visitors: 1 });
  });

  it("runs everything: yesterday's totals, then the cleanup", async () => {
    await db.insert(analyticsSalts).values([
      { day: "2026-10-28", salt: "old" },
      { day: "2026-10-29", salt: "today" },
    ]);
    await db.insert(analyticsEvents).values([row("2026-10-28T16:00:00Z")]);
    // 08:00 UTC on 29 Oct is 02:00 in Monterrey.
    const summary = await runDailyJob(db, new Date("2026-10-29T08:00:00Z"));
    expect(summary.saltsDeleted).toBe(1);
    expect(Object.keys(summary.days)).toEqual(["2026-10-27", "2026-10-28"]);
    expect(JSON.stringify(summary)).not.toContain("v1");
    const totals = await db
      .select()
      .from(analyticsDaily)
      .where(
        sql`${analyticsDaily.dimension} = 'total' and ${analyticsDaily.day} = '2026-10-28'`,
      );
    expect(totals[0]?.visitors).toBe(1);
  });
});
