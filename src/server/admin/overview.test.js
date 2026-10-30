import { describe, expect, it } from "vitest";
import {
  autoGranularity,
  buildOverview,
  readOverviewRequest,
} from "./overview.js";

const now = new Date("2026-11-04T18:00:00Z");
const same = { percent: 0, direction: /** @type {const} */ ("same") };

describe("autoGranularity", () => {
  it("groups by day, week, month or year according to the length of the range", () => {
    expect(autoGranularity("2026-10-29", "2026-11-04")).toBe("day");
    expect(autoGranularity("2026-10-06", "2026-12-06")).toBe("day");
    expect(autoGranularity("2026-01-01", "2026-06-30")).toBe("week");
    expect(autoGranularity("2026-01-01", "2027-06-30")).toBe("month");
    expect(autoGranularity("2026-01-01", "2030-12-31")).toBe("year");
  });
});

describe("readOverviewRequest", () => {
  it("defaults to the last 30 days, by day", () => {
    const request = readOverviewRequest({}, now);
    expect(request.range.preset).toBe("30d");
    expect(request.granularity).toBe("day");
  });

  it("takes the granularity of the address when it is valid and ignores it otherwise", () => {
    expect(readOverviewRequest({ g: "month" }, now).granularity).toBe("month");
    expect(readOverviewRequest({ g: "hour" }, now).granularity).toBe("day");
  });

  it("compares only when the previous period reaches the tracker's first day", () => {
    // The tracker started on 29 Oct, and "now" is 4 Nov.
    // Today against yesterday: yesterday had a tracker.
    expect(readOverviewRequest({ range: "today" }, now).compare).toBe(true);
    // The 7 days before 29 Oct (22 to 28 Oct) are before the tracker existed.
    expect(readOverviewRequest({ range: "7d" }, now).compare).toBe(false);
    expect(readOverviewRequest({ range: "all" }, now).compare).toBe(false);
    expect(
      readOverviewRequest(
        { range: "custom", from: "2026-10-29", to: "2026-10-30" },
        now,
      ).compare,
    ).toBe(false);
  });
});

/**
 * @param {Partial<import("../analytics/query.js").AnalyticsResult>} [extra] - What to change.
 * @returns {import("../analytics/query.js").AnalyticsResult} A small answer of the query API.
 */
function result(extra = {}) {
  const metrics = {
    visitors: 40,
    sessions: 50,
    pageViews: 120,
    events: 300,
    engagedSeconds: 3000,
    bounces: 20,
    bounceRate: 0.4,
    avgEngagedSeconds: 60,
  };
  return {
    range: { from: "2026-11-02", to: "2026-11-04", granularity: "day" },
    through: "2026-11-04",
    totals: metrics,
    contacts: { visitors: 5, messages: 2, whatsapp: 7 },
    distributions: { engaged_seconds: { samples: 30, p50: 42, p75: 90 } },
    series: [
      { ...metrics, bucket: "2026-11-02", visitors: 10 },
      { ...metrics, bucket: "2026-11-04", visitors: 30 },
    ],
    breakdowns: {},
    comparison: null,
    ...extra,
  };
}

describe("buildOverview", () => {
  it("makes the six tiles with their numbers written in Spanish", () => {
    const { tiles } = buildOverview(result());
    expect(tiles.map((tile) => tile.id)).toEqual([
      "visitors",
      "sessions",
      "engaged",
      "messages",
      "whatsapp",
      "conversion",
    ]);
    const byId = Object.fromEntries(tiles.map((tile) => [tile.id, tile]));
    expect(byId.visitors.display).toBe("40");
    expect(byId.engaged.display).toBe("1\u00a0min");
    expect(byId.engaged.note).toContain("Mediana: 42\u00a0s");
    expect(byId.messages.value).toBe(2);
    expect(byId.whatsapp.value).toBe(7);
    // 5 of 40 visitors contacted the business.
    expect(byId.conversion.display).toBe("12.5\u00a0%");
    expect(byId.conversion.value).toBe(12.5);
  });

  it("has no previous numbers when it is not compared", () => {
    const { tiles, visits } = buildOverview(result());
    expect(tiles.every((tile) => tile.previous === undefined)).toBe(true);
    expect(visits.previousValues).toBeNull();
    expect(visits.previousTotal).toBeNull();
  });

  it("puts a zero on the days without data", () => {
    const { visits } = buildOverview(result());
    expect(visits.buckets).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(visits.values).toEqual([10, 0, 30]);
  });

  it("carries the previous period for the tiles and the dashed line", () => {
    const base = result();
    const metrics = {
      ...base.totals,
      visitors: 20,
      sessions: 25,
      avgEngagedSeconds: 30,
    };
    const { tiles, visits } = buildOverview(
      result({
        comparison: {
          from: "2026-10-30",
          to: "2026-11-01",
          totals: metrics,
          contacts: { visitors: 1, messages: 1, whatsapp: 3 },
          series: [{ ...metrics, bucket: "2026-10-31", visitors: 20 }],
          distributions: {},
          changes: {
            visitors: same,
            sessions: same,
            pageViews: same,
            events: same,
            avgEngagedSeconds: same,
            medianEngagedSeconds: same,
          },
        },
      }),
    );
    const byId = Object.fromEntries(tiles.map((tile) => [tile.id, tile]));
    expect(byId.visitors.previous).toBe(20);
    expect(byId.engaged.previous).toBe(30);
    expect(byId.whatsapp.previous).toBe(3);
    // 1 of 20 visitors contacted the business before.
    expect(byId.conversion.previous).toBe(5);
    expect(visits.previousBuckets).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(visits.previousValues).toEqual([0, 20, 0]);
    expect(visits.previousTotal).toBe(20);
  });

  it("does not divide by zero when nobody visited", () => {
    const base = result();
    const empty = buildOverview(
      result({
        totals: {
          ...base.totals,
          visitors: 0,
          sessions: 0,
          events: 0,
          avgEngagedSeconds: 0,
        },
        contacts: { visitors: 0, messages: 0, whatsapp: 0 },
        distributions: {},
        series: [],
      }),
    );
    expect(empty.empty).toBe(true);
    expect(empty.tiles.find((tile) => tile.id === "conversion")?.display).toBe(
      "0\u00a0%",
    );
    expect(empty.tiles.find((tile) => tile.id === "engaged")?.note).toBe(
      "Promedio por sesión",
    );
    expect(empty.visits.values).toEqual([0, 0, 0]);
  });
});
