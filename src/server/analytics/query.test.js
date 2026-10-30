// @vitest-environment node
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  analyticsDaily,
  analyticsDistributions,
  analyticsEvents,
} from "../db/schema.js";
import { histogramOf } from "./distribution.js";
import {
  BREAKDOWN_LIMIT,
  clearAnalyticsCache,
  countLiveVisitors,
  MAX_EXPORT_ROWS,
  readTable,
  TODAY_TTL_MS,
  parseAnalyticsQuery,
  queryAnalytics,
  queryAnalyticsCached,
} from "./query.js";

const migrationsFolder = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);

const now = new Date("2026-11-04T18:00:00Z");

/**
 * @param {string} day - The day.
 * @param {string} dimension - The dimension.
 * @param {string} key - The key.
 * @param {Partial<typeof analyticsDaily.$inferInsert>} counts - The counts.
 * @returns {typeof analyticsDaily.$inferInsert} A row.
 */
const daily = (day, dimension, key, counts) => ({
  day,
  dimension,
  key,
  ...counts,
});

describe("parseAnalyticsQuery", () => {
  it("accepts a range and defaults the granularity to day", () => {
    const result = parseAnalyticsQuery(
      { from: "2026-10-29", to: "2026-11-03" },
      now,
    );
    expect(result).toEqual({
      ok: true,
      query: {
        from: "2026-10-29",
        to: "2026-11-03",
        granularity: "day",
        compare: false,
      },
    });
  });

  it("puts a reversed range in order, cuts it at today and at the launch day", () => {
    const result = parseAnalyticsQuery(
      { from: "2030-01-01", to: "2020-01-01", compare: "previous" },
      now,
    );
    expect(result).toEqual({
      ok: true,
      query: {
        from: "2026-10-29",
        to: "2026-11-04",
        granularity: "day",
        compare: true,
      },
    });
  });

  it("refuses what is not a date, a granularity or a comparison", () => {
    for (const query of [
      {},
      { from: "2026-10-29" },
      { from: "yesterday", to: "2026-11-03" },
      { from: "2026-13-45", to: "2026-11-03" },
      { from: "2026-10-29", to: "2026-11-03", granularity: "hour" },
      { from: "2026-10-29", to: "2026-11-03", compare: "year" },
    ]) {
      expect(parseAnalyticsQuery(query, now).ok).toBe(false);
    }
  });
});

describe("analytics query (in-memory Postgres)", () => {
  const db = drizzle(new PGlite());

  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
  });

  beforeEach(async () => {
    clearAnalyticsCache();
    await db.delete(analyticsEvents);
    await db.delete(analyticsDaily);
    await db.delete(analyticsDistributions);
    await db.insert(analyticsDaily).values([
      // Thursday 29 Oct to Saturday 31 Oct and Sunday 1 Nov: the week of Monday 26 Oct.
      daily("2026-10-29", "total", "all", {
        visitors: 10,
        sessions: 12,
        pageViews: 30,
        events: 50,
        engagedSeconds: 600,
        bounces: 6,
      }),
      daily("2026-10-30", "total", "all", {
        visitors: 20,
        sessions: 24,
        pageViews: 60,
        events: 90,
        engagedSeconds: 1200,
        bounces: 12,
      }),
      daily("2026-11-01", "total", "all", {
        visitors: 5,
        sessions: 6,
        pageViews: 10,
        events: 20,
        engagedSeconds: 60,
        bounces: 3,
      }),
      // Monday 2 Nov and Tuesday 3 Nov: the week of Monday 2 Nov, in a new month.
      daily("2026-11-02", "total", "all", {
        visitors: 40,
        sessions: 40,
        pageViews: 100,
        events: 150,
        engagedSeconds: 2000,
        bounces: 10,
      }),
      daily("2026-11-03", "total", "all", {
        visitors: 30,
        sessions: 30,
        pageViews: 90,
        events: 120,
        engagedSeconds: 1500,
        bounces: 5,
      }),
      daily("2026-10-29", "channel", "instagram", {
        visitors: 4,
        pageViews: 9,
      }),
      daily("2026-11-02", "channel", "instagram", {
        visitors: 6,
        pageViews: 11,
      }),
      daily("2026-10-30", "channel", "direct", { visitors: 3, pageViews: 5 }),
      daily("2026-11-02", "path", "/", { visitors: 25, pageViews: 60 }),
    ]);
  });

  /**
   * @param {Partial<import("./query.js").AnalyticsQuery>} [query] - What to change.
   * @returns {import("./query.js").AnalyticsQuery} A query over the whole fixture.
   */
  const whole = (query = {}) => ({
    from: "2026-10-29",
    to: "2026-11-04",
    granularity: /** @type {const} */ ("day"),
    compare: false,
    ...query,
  });

  it("adds up the totals and derives the rates", async () => {
    const result = await queryAnalytics(db, whole());
    expect(result.totals).toEqual({
      visitors: 105,
      sessions: 112,
      pageViews: 290,
      events: 430,
      engagedSeconds: 5360,
      bounces: 36,
      bounceRate: 0.321,
      avgEngagedSeconds: 48,
    });
    expect(result.through).toBe("2026-11-03");
  });

  it("returns one point per day with data, in order", async () => {
    const result = await queryAnalytics(db, whole());
    expect(result.series.map((p) => p.bucket)).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-11-01",
      "2026-11-02",
      "2026-11-03",
    ]);
  });

  it("groups by week starting on Monday", async () => {
    const result = await queryAnalytics(db, whole({ granularity: "week" }));
    expect(result.series.map((p) => [p.bucket, p.visitors])).toEqual([
      ["2026-10-26", 35],
      ["2026-11-02", 70],
    ]);
  });

  it("groups by month and by year from the daily rows", async () => {
    const month = await queryAnalytics(db, whole({ granularity: "month" }));
    expect(month.series.map((p) => [p.bucket, p.visitors])).toEqual([
      ["2026-10-01", 30],
      ["2026-11-01", 75],
    ]);
    const year = await queryAnalytics(db, whole({ granularity: "year" }));
    expect(year.series.map((p) => [p.bucket, p.visitors])).toEqual([
      ["2026-01-01", 105],
    ]);
  });

  it("only counts the days inside the range, ends included", async () => {
    const result = await queryAnalytics(
      db,
      whole({ from: "2026-10-30", to: "2026-11-01" }),
    );
    expect(result.totals.visitors).toBe(25);
  });

  it("returns breakdowns, biggest first, and empty ones for dimensions with no rows", async () => {
    const result = await queryAnalytics(db, whole());
    expect(result.breakdowns.channel).toEqual([
      expect.objectContaining({
        key: "instagram",
        visitors: 10,
        pageViews: 20,
      }),
      expect.objectContaining({ key: "direct", visitors: 3, pageViews: 5 }),
    ]);
    expect(result.breakdowns.path[0].key).toBe("/");
    expect(result.breakdowns.country).toEqual([]);
  });

  it("keeps a breakdown to its limit", async () => {
    await db.insert(analyticsDaily).values(
      Array.from({ length: BREAKDOWN_LIMIT + 5 }, (_, index) =>
        daily("2026-11-03", "city", `city-${String(index).padStart(2, "0")}`, {
          visitors: 1,
        }),
      ),
    );
    const result = await queryAnalytics(db, whole());
    expect(result.breakdowns.city).toHaveLength(BREAKDOWN_LIMIT);
  });

  it("compares with the previous period of the same length", async () => {
    const result = await queryAnalytics(
      db,
      whole({ from: "2026-11-02", to: "2026-11-03", compare: true }),
    );
    expect(result.totals.visitors).toBe(70);
    expect(result.comparison).toMatchObject({
      from: "2026-10-31",
      to: "2026-11-01",
      totals: { visitors: 5 },
      changes: { visitors: { percent: 1300, direction: "up" } },
    });
  });

  it("marks a comparison with an empty previous period as new", async () => {
    const result = await queryAnalytics(
      db,
      whole({ from: "2026-10-29", to: "2026-10-29", compare: true }),
    );
    expect(result.comparison?.changes.visitors).toEqual({
      percent: null,
      direction: "new",
    });
  });

  it("answers zeros, not an error, when there is no data", async () => {
    await db.delete(analyticsDaily);
    const result = await queryAnalytics(db, whole());
    expect(result.totals.visitors).toBe(0);
    expect(result.totals.bounceRate).toBe(0);
    expect(result.series).toEqual([]);
    expect(result.through).toBeNull();
  });

  it("reuses an answer for a few minutes", async () => {
    const query = whole({ to: "2026-11-03" });
    const first = await queryAnalyticsCached(db, query, now);
    await db.delete(analyticsDaily);
    const soon = await queryAnalyticsCached(
      db,
      query,
      new Date(now.getTime() + 60_000),
    );
    expect(soon).toBe(first);
    const later = await queryAnalyticsCached(
      db,
      query,
      new Date(now.getTime() + 600_000),
    );
    expect(later.totals.visitors).toBe(0);
  });

  describe("today", () => {
    /**
     * @param {string} visitorId - The visitor.
     * @param {string} iso - When.
     * @returns {typeof analyticsEvents.$inferInsert} A page view.
     */
    const view = (visitorId, iso) => ({
      occurredAt: new Date(iso),
      visitorId,
      type: "page_view",
      path: "/",
      locale: "es",
      channel: "direct",
      device: "desktop",
      browser: "Chrome",
      os: "Windows",
      screen: "large",
    });
    // 12:00 in Monterrey on 4 Nov, so "today" is 2026-11-04.
    const today = whole({ from: "2026-11-03", to: "2026-11-04" });

    it("includes today when the range ends today", async () => {
      await db
        .insert(analyticsEvents)
        .values([
          view("a", "2026-11-04T16:00:00Z"),
          view("b", "2026-11-04T17:00:00Z"),
        ]);
      const result = await queryAnalyticsCached(db, today, now);
      expect(result.through).toBe("2026-11-04");
      expect(result.totals.visitors).toBe(30 + 2);
      expect(result.series.at(-1)).toMatchObject({
        bucket: "2026-11-04",
        visitors: 2,
        pageViews: 2,
      });
    });

    it("recomputes today at most once a minute", async () => {
      await db
        .insert(analyticsEvents)
        .values(view("a", "2026-11-04T16:00:00Z"));
      await queryAnalyticsCached(db, today, now);
      await db
        .insert(analyticsEvents)
        .values(view("b", "2026-11-04T16:30:00Z"));
      const soon = await queryAnalyticsCached(
        db,
        today,
        new Date(now.getTime() + TODAY_TTL_MS - 1000),
      );
      expect(soon.totals.visitors).toBe(30 + 1);
      const later = await queryAnalyticsCached(
        db,
        today,
        new Date(now.getTime() + TODAY_TTL_MS + 1000),
      );
      expect(later.totals.visitors).toBe(30 + 2);
    });

    it("gives the same numbers when today is recomputed with no new events", async () => {
      await db
        .insert(analyticsEvents)
        .values(view("a", "2026-11-04T16:00:00Z"));
      const first = await queryAnalyticsCached(db, today, now);
      const second = await queryAnalyticsCached(
        db,
        today,
        new Date(now.getTime() + 2 * TODAY_TTL_MS),
      );
      expect(second).toEqual(first);
    });

    it("leaves today alone when the range ends before it", async () => {
      await db
        .insert(analyticsEvents)
        .values(view("a", "2026-11-04T16:00:00Z"));
      const result = await queryAnalyticsCached(
        db,
        whole({ to: "2026-11-03" }),
        now,
      );
      expect(result.through).toBe("2026-11-03");
      const rows = await db.select().from(analyticsDaily);
      expect(rows.some((row) => row.day === "2026-11-04")).toBe(false);
    });

    it("answers a day with no events as zero", async () => {
      const result = await queryAnalyticsCached(db, today, now);
      expect(result.totals.visitors).toBe(30);
      expect(result.series.at(-1)).toMatchObject({
        bucket: "2026-11-04",
        visitors: 0,
      });
    });
  });

  describe("export tables", () => {
    it("returns every row of a dimension, not only the top ones", async () => {
      await db.insert(analyticsDaily).values(
        Array.from({ length: BREAKDOWN_LIMIT + 5 }, (_, index) =>
          daily(
            "2026-11-03",
            "city",
            `city-${String(index).padStart(2, "0")}`,
            {
              visitors: 1,
            },
          ),
        ),
      );
      const rows = await readTable(
        db,
        whole({ to: "2026-11-03" }),
        "city",
        now,
      );
      expect(rows).toHaveLength(BREAKDOWN_LIMIT + 5);
    });

    it("returns the series with its buckets", async () => {
      const rows = await readTable(
        db,
        whole({ granularity: "week", to: "2026-11-03" }),
        "series",
        now,
      );
      expect(
        rows.map((row) => [
          /** @type {{ bucket: string }} */ (row).bucket,
          row.visitors,
        ]),
      ).toEqual([
        ["2026-10-26", 35],
        ["2026-11-02", 70],
      ]);
    });

    it("matches what the dashboard shows for the same range", async () => {
      const query = whole({ to: "2026-11-03" });
      const shown = await queryAnalytics(db, query);
      const rows = await readTable(db, query, "channel", now);
      expect(rows).toEqual(shown.breakdowns.channel);
    });

    it("is empty for a dimension with no rows", async () => {
      expect(
        await readTable(db, whole({ to: "2026-11-03" }), "os", now),
      ).toEqual([]);
    });

    it("includes today when the range ends today", async () => {
      await db.insert(analyticsEvents).values({
        occurredAt: new Date("2026-11-04T16:00:00Z"),
        visitorId: "a",
        type: "page_view",
        path: "/",
        locale: "es",
        channel: "direct",
        device: "desktop",
        browser: "Chrome",
        os: "Windows",
        screen: "large",
      });
      const rows = await readTable(db, whole(), "series", now);
      expect(rows.at(-1)).toMatchObject({ bucket: "2026-11-04", visitors: 1 });
    });

    it("keeps the row limit above what a dashboard needs", () => {
      expect(MAX_EXPORT_ROWS).toBeGreaterThan(BREAKDOWN_LIMIT);
    });
  });

  describe("event counts", () => {
    beforeEach(async () => {
      await db.insert(analyticsDaily).values([
        daily("2026-11-02", "event", "contact_view", {
          events: 10,
          visitors: 8,
        }),
        daily("2026-11-03", "event", "contact_view", {
          events: 5,
          visitors: 4,
        }),
        daily("2026-11-03", "event", "form_success", {
          events: 1,
          visitors: 1,
        }),
        daily("2026-10-30", "event", "contact_view", {
          events: 99,
          visitors: 99,
        }),
        daily("2026-11-03", "channel", "direct", { events: 7, visitors: 7 }),
      ]);
    });

    it("adds up every kind of event of the range", async () => {
      const result = await queryAnalytics(
        db,
        whole({ from: "2026-11-02", to: "2026-11-03" }),
      );
      expect(result.events).toEqual({
        contact_view: { events: 15, visitors: 12 },
        form_success: { events: 1, visitors: 1 },
      });
    });

    it("leaves out the kinds that did not happen and the days outside the range", async () => {
      const result = await queryAnalytics(
        db,
        whole({ from: "2026-11-03", to: "2026-11-03" }),
      );
      expect(result.events.form_start).toBeUndefined();
      expect(result.events.contact_view).toEqual({ events: 5, visitors: 4 });
    });

    it("does not lose a kind of event when there are more kinds than a breakdown holds", async () => {
      await db.insert(analyticsDaily).values(
        Array.from({ length: BREAKDOWN_LIMIT + 5 }, (_, index) =>
          daily(
            "2026-11-03",
            "event",
            `kind-${String(index).padStart(2, "0")}`,
            {
              events: 1000,
              visitors: 1000,
            },
          ),
        ),
      );
      const result = await queryAnalytics(
        db,
        whole({ from: "2026-11-03", to: "2026-11-03" }),
      );
      expect(result.events.form_success).toEqual({ events: 1, visitors: 1 });
      expect(Object.keys(result.breakdowns.event)).toHaveLength(
        BREAKDOWN_LIMIT,
      );
    });
  });

  describe("contacts and the previous series", () => {
    beforeEach(async () => {
      await db.insert(analyticsDaily).values([
        daily("2026-11-02", "conversion", "contacted", { visitors: 4 }),
        daily("2026-11-03", "conversion", "contacted", { visitors: 3 }),
        daily("2026-11-02", "event", "form_success", {
          events: 2,
          visitors: 2,
        }),
        daily("2026-11-03", "event", "form_success", {
          events: 1,
          visitors: 1,
        }),
        daily("2026-11-02", "event", "whatsapp_click", {
          events: 5,
          visitors: 4,
        }),
        daily("2026-11-03", "event", "page_view", {
          events: 40,
          visitors: 30,
        }),
        daily("2026-10-30", "conversion", "contacted", { visitors: 1 }),
        daily("2026-10-30", "event", "whatsapp_click", {
          events: 2,
          visitors: 1,
        }),
      ]);
    });

    it("adds up the contacts of the range", async () => {
      const result = await queryAnalytics(
        db,
        whole({ from: "2026-11-02", to: "2026-11-03" }),
      );
      expect(result.contacts).toEqual({
        visitors: 7,
        messages: 3,
        whatsapp: 5,
      });
    });

    it("gives zeros when nobody contacted", async () => {
      const result = await queryAnalytics(
        db,
        whole({ from: "2026-10-29", to: "2026-10-29" }),
      );
      expect(result.contacts).toEqual({
        visitors: 0,
        messages: 0,
        whatsapp: 0,
      });
    });

    it("gives the contacts and the series of the previous period when comparing", async () => {
      const result = await queryAnalytics(
        db,
        whole({ from: "2026-11-02", to: "2026-11-03", compare: true }),
      );
      // The two days before: 31 Oct and 1 Nov.
      expect(result.comparison?.contacts).toEqual({
        visitors: 0,
        messages: 0,
        whatsapp: 0,
      });
      expect(result.comparison?.series.map((point) => point.bucket)).toEqual([
        "2026-11-01",
      ]);
      expect(result.comparison?.series[0].visitors).toBe(5);
    });

    it("compares a longer range with the period before it", async () => {
      const result = await queryAnalytics(
        db,
        whole({ from: "2026-11-01", to: "2026-11-03", compare: true }),
      );
      expect(result.comparison).toMatchObject({
        from: "2026-10-29",
        to: "2026-10-31",
        contacts: { visitors: 1, whatsapp: 2 },
      });
      expect(result.comparison?.series.map((point) => point.bucket)).toEqual([
        "2026-10-29",
        "2026-10-30",
      ]);
    });
  });

  describe("distributions", () => {
    /**
     * @param {string} day - The day.
     * @param {number[]} seconds - Active seconds of the sessions of that day.
     * @returns {typeof analyticsDistributions.$inferInsert} A row.
     */
    const engaged = (day, seconds) => ({
      day,
      metric: "engaged_seconds",
      samples: seconds.length,
      buckets: histogramOf("engaged_seconds", seconds),
    });

    it("gives the median and p75 of the whole range, summing the days", async () => {
      await db
        .insert(analyticsDistributions)
        .values([
          engaged("2026-11-02", [11, 12]),
          engaged("2026-11-03", [13, 14]),
        ]);
      const result = await queryAnalytics(
        db,
        whole({ from: "2026-11-02", to: "2026-11-03" }),
      );
      expect(result.distributions).toEqual({
        engaged_seconds: { samples: 4, p50: 15, p75: 17.5 },
      });
    });

    it("only reads the days inside the range", async () => {
      await db
        .insert(analyticsDistributions)
        .values([engaged("2026-10-30", [400]), engaged("2026-11-03", [11])]);
      const result = await queryAnalytics(
        db,
        whole({ from: "2026-11-02", to: "2026-11-03" }),
      );
      expect(result.distributions.engaged_seconds.samples).toBe(1);
    });

    it("has no entry for a metric with no samples", async () => {
      const result = await queryAnalytics(db, whole());
      expect(result.distributions).toEqual({});
    });

    it("compares the median with the previous period", async () => {
      await db
        .insert(analyticsDistributions)
        .values([
          engaged("2026-11-02", [11, 12]),
          engaged("2026-11-03", [31, 32]),
        ]);
      const result = await queryAnalytics(
        db,
        whole({ from: "2026-11-03", to: "2026-11-03", compare: true }),
      );
      expect(result.comparison?.distributions.engaged_seconds.samples).toBe(2);
      expect(result.comparison?.changes.medianEngagedSeconds.direction).toBe(
        "up",
      );
    });

    it("marks the median as new when the previous period has none", async () => {
      await db
        .insert(analyticsDistributions)
        .values(engaged("2026-11-03", [11]));
      const result = await queryAnalytics(
        db,
        whole({ from: "2026-11-03", to: "2026-11-03", compare: true }),
      );
      expect(result.comparison?.changes.medianEngagedSeconds).toEqual({
        percent: null,
        direction: "new",
      });
    });

    it("includes today's histogram when the range ends today", async () => {
      await db.insert(analyticsEvents).values([
        {
          occurredAt: new Date("2026-11-04T16:00:00Z"),
          visitorId: "a",
          type: "page_view",
          path: "/",
          locale: "es",
          channel: "direct",
          device: "desktop",
          browser: "Chrome",
          os: "Windows",
          screen: "large",
        },
        {
          occurredAt: new Date("2026-11-04T16:01:00Z"),
          visitorId: "a",
          type: "engagement",
          path: "/",
          locale: "es",
          channel: "direct",
          device: "desktop",
          browser: "Chrome",
          os: "Windows",
          screen: "large",
          props: { seconds: 12, scroll: 50 },
        },
      ]);
      const result = await queryAnalyticsCached(db, whole(), now);
      expect(result.distributions.engaged_seconds.samples).toBe(1);
    });
  });

  describe("live visitors", () => {
    /**
     * @param {string} visitorId - The visitor.
     * @param {string} iso - When.
     * @returns {typeof analyticsEvents.$inferInsert} An event.
     */
    const event = (visitorId, iso) => ({
      occurredAt: new Date(iso),
      visitorId,
      type: "page_view",
      path: "/",
      locale: "es",
      channel: "direct",
      device: "desktop",
      browser: "Chrome",
      os: "Windows",
      screen: "large",
    });

    it("counts distinct visitors with an event in the last 30 minutes", async () => {
      await db
        .insert(analyticsEvents)
        .values([
          event("a", "2026-11-04T17:50:00Z"),
          event("a", "2026-11-04T17:59:00Z"),
          event("b", "2026-11-04T17:31:00Z"),
          event("c", "2026-11-04T17:29:00Z"),
          event("d", "2026-11-04T18:05:00Z"),
        ]);
      expect(await countLiveVisitors(db, now)).toBe(2);
    });

    it("is zero when nobody is on the site", async () => {
      expect(await countLiveVisitors(db, now)).toBe(0);
    });
  });
});
