import { describe, expect, it } from "vitest";
import {
  computeDailyRollup,
  computeDistributions,
  splitSessions,
} from "./rollup.js";

/**
 * Builds an event with sensible defaults.
 * @param {Partial<import("./rollup.js").EventRow> & { minute?: number }} override - What to change.
 * @returns {import("./rollup.js").EventRow} The event.
 */
function event({ minute = 0, ...override } = {}) {
  return {
    visitorId: "v1",
    occurredAt: new Date(Date.UTC(2026, 9, 29, 15, minute)),
    type: "page_view",
    path: "/",
    locale: "es",
    channel: "direct",
    referrerHost: null,
    country: "MX",
    region: "Nuevo León",
    city: "Monterrey",
    device: "mobile",
    browser: "Safari",
    os: "iOS",
    props: null,
    ...override,
  };
}

/**
 * @param {import("./rollup.js").DailyRow[]} rows - The rows.
 * @param {string} dimension - The dimension.
 * @param {string} [key] - The key.
 * @returns {import("./rollup.js").DailyRow | undefined} The row.
 */
const find = (rows, dimension, key = "") =>
  rows.find((row) => row.dimension === dimension && row.key === key);

describe("splitSessions", () => {
  it("starts a new session after 30 minutes of silence, per visitor", () => {
    const sessions = splitSessions([
      event({ minute: 0 }),
      event({ minute: 10 }),
      event({ minute: 41 }),
      event({ visitorId: "v2", minute: 5 }),
    ]);
    expect(sessions.map((session) => session.length).sort()).toEqual([1, 1, 2]);
  });

  it("keeps events 30 minutes apart in the same session", () => {
    expect(
      splitSessions([event({ minute: 0 }), event({ minute: 30 })]),
    ).toHaveLength(1);
  });
});

describe("computeDailyRollup", () => {
  const events = [
    // Visitor 1: Instagram, two pages, 40 seconds engaged, opens WhatsApp from the floating button.
    event({ channel: "instagram", referrerHost: "l.instagram.com", minute: 0 }),
    event({
      type: "engagement",
      props: { seconds: 25, scroll: 50 },
      minute: 1,
    }),
    event({ path: "/contact", channel: "instagram", minute: 2 }),
    event({
      type: "engagement",
      props: { seconds: 15, scroll: 100 },
      path: "/contact",
      minute: 3,
    }),
    event({
      type: "whatsapp_click",
      props: { placement: "floating" },
      minute: 4,
    }),
    // Visitor 2: a bounce (one page, 3 seconds), from Google Maps on a computer.
    event({
      visitorId: "v2",
      channel: "google_maps",
      device: "desktop",
      browser: "Chrome",
      os: "Windows",
      locale: "en",
      minute: 5,
    }),
    event({
      visitorId: "v2",
      type: "engagement",
      props: { seconds: 3 },
      minute: 6,
    }),
    // Visitor 1 again, two hours later: a second session.
    event({ minute: 125 }),
    event({
      type: "section_view",
      props: { section: "services" },
      minute: 126,
    }),
  ];
  const rows = computeDailyRollup(events, "2026-10-29");

  it("counts visitors once, however many events they have", () => {
    expect(find(rows, "total")).toMatchObject({
      visitors: 2,
      events: 9,
      pageViews: 4,
      engagedSeconds: 43,
    });
  });

  it("counts sessions and bounces", () => {
    // v1 has two sessions, v2 one; v2 is a bounce, and so is v1's second (one page view, no time).
    expect(find(rows, "total")).toMatchObject({ sessions: 3, bounces: 2 });
  });

  it("groups page views, visitors and sessions by source", () => {
    expect(find(rows, "channel", "instagram")).toMatchObject({
      visitors: 1,
      pageViews: 2,
      sessions: 1,
      bounces: 0,
    });
    expect(find(rows, "channel", "google_maps")).toMatchObject({
      visitors: 1,
      sessions: 1,
      bounces: 1,
    });
  });

  it("groups by device, browser, language and location", () => {
    expect(find(rows, "device", "desktop")?.visitors).toBe(1);
    expect(find(rows, "browser", "Chrome")?.pageViews).toBe(1);
    expect(find(rows, "locale", "en")?.pageViews).toBe(1);
    expect(find(rows, "city", "Monterrey")?.visitors).toBe(2);
  });

  it("counts pages and the funnel events", () => {
    expect(find(rows, "path", "/contact")).toMatchObject({
      pageViews: 1,
      visitors: 1,
    });
    expect(find(rows, "event", "whatsapp_click")).toMatchObject({
      events: 1,
      visitors: 1,
    });
    expect(find(rows, "event", "page_view")?.events).toBe(4);
  });

  it("counts sections and where WhatsApp was clicked", () => {
    expect(find(rows, "section", "services")).toMatchObject({
      events: 1,
      visitors: 1,
    });
    expect(find(rows, "whatsapp", "floating")).toMatchObject({
      events: 1,
      visitors: 1,
    });
  });

  it("gives the same rows when run twice and in any order", () => {
    const again = computeDailyRollup([...events].reverse(), "2026-10-29");
    expect(again).toEqual(rows);
  });

  it("has no visitor ids or raw details in the rows", () => {
    const text = JSON.stringify(rows);
    expect(text).not.toContain("v1");
    expect(text).not.toContain("v2");
    expect(text).not.toContain("Mozilla");
  });

  it("returns only the zero row for a day without events", () => {
    expect(computeDailyRollup([], "2026-10-29")).toEqual([
      expect.objectContaining({ dimension: "total", visitors: 0, sessions: 0 }),
    ]);
  });
});

describe("computeDistributions", () => {
  /**
   * @param {number} seconds - Seconds of active time.
   * @param {Partial<import("./rollup.js").EventRow> & { minute?: number }} [override] - What to change.
   * @returns {import("./rollup.js").EventRow} An engagement event.
   */
  const engagement = (seconds, override = {}) =>
    event({ type: "engagement", props: { seconds, scroll: 50 }, ...override });

  it("gives no rows when nothing was measured", () => {
    expect(computeDistributions([], "2026-10-29")).toEqual([]);
    expect(computeDistributions([event()], "2026-10-29")).toEqual([]);
  });

  it("adds the engagement of a session and counts it once", () => {
    const rows = computeDistributions(
      [
        event({ minute: 0 }),
        engagement(8, { minute: 1 }),
        event({ minute: 2, path: "/en/" }),
        engagement(9, { minute: 3 }),
      ],
      "2026-10-29",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      day: "2026-10-29",
      metric: "engaged_seconds",
      samples: 1,
    });
    // 8 + 9 = 17 seconds: the 10 to 20 second bucket.
    expect(rows[0].buckets[2]).toBe(1);
  });

  it("counts a session for each visitor and for each stretch after 30 minutes of silence", () => {
    const rows = computeDistributions(
      [
        event({ minute: 0 }),
        engagement(3, { minute: 1 }),
        event({ minute: 60 }),
        engagement(40, { minute: 61 }),
        event({ visitorId: "v2", minute: 0 }),
        engagement(100, { visitorId: "v2", minute: 2 }),
      ],
      "2026-10-29",
    );
    expect(rows[0].samples).toBe(3);
  });

  it("leaves out a session where the tracker never sent engagement", () => {
    const rows = computeDistributions(
      [
        event({ visitorId: "left-early" }),
        event({ visitorId: "stayed", minute: 1 }),
        engagement(20, { visitorId: "stayed", minute: 2 }),
      ],
      "2026-10-29",
    );
    expect(rows[0].samples).toBe(1);
  });

  it("keeps a measured session of zero seconds", () => {
    const rows = computeDistributions(
      [event(), engagement(0, { minute: 1 })],
      "2026-10-29",
    );
    expect(rows[0]).toMatchObject({ samples: 1 });
    expect(rows[0].buckets[0]).toBe(1);
  });

  it("does not change the totals of the day", () => {
    const events = [event(), engagement(20, { minute: 1 })];
    const before = computeDailyRollup(events, "2026-10-29");
    computeDistributions(events, "2026-10-29");
    expect(computeDailyRollup(events, "2026-10-29")).toEqual(before);
  });

  describe("speed measures", () => {
    /**
     * @param {Record<string, number | string>} props - What the tracker sent.
     * @param {Partial<import("./rollup.js").EventRow> & { minute?: number }} [override] - What to change.
     * @returns {import("./rollup.js").EventRow} A web_vital event.
     */
    const vital = (props, override = {}) =>
      event({ type: "web_vital", props, ...override });

    it("keeps one histogram per measure with a sample for each page view", () => {
      const rows = computeDistributions(
        [
          vital({ lcp: 1800, cls: 0.02, fcp: 900, ttfb: 150, inp: 120 }),
          vital({ lcp: 3200, fcp: 1200 }, { visitorId: "v2" }),
        ],
        "2026-10-29",
      );
      const samples = Object.fromEntries(
        rows.map((row) => [row.metric, row.samples]),
      );
      expect(samples).toEqual({ lcp: 2, inp: 1, cls: 1, fcp: 2, ttfb: 1 });
    });

    it("ignores values that are not numbers and events of other types", () => {
      const rows = computeDistributions(
        [
          vital({ lcp: "fast", fcp: 900 }),
          event({ type: "page_view", props: { lcp: 100 } }),
        ],
        "2026-10-29",
      );
      expect(rows.map((row) => row.metric)).toEqual(["fcp"]);
    });

    it("puts each value in the bucket of its good, needs improvement or poor range", () => {
      const [lcp] = computeDistributions(
        [
          vital({ lcp: 2400 }),
          vital({ lcp: 3900 }, { visitorId: "v2" }),
          vital({ lcp: 7000 }, { visitorId: "v3" }),
        ],
        "2026-10-29",
      );
      // 2500 ms and 4000 ms are the limits of good and poor.
      expect(lcp.buckets[4]).toBe(1);
      expect(lcp.buckets[6]).toBe(1);
      expect(lcp.buckets[8]).toBe(1);
    });

    it("does not count the speed events as sessions' engagement", () => {
      const rows = computeDistributions(
        [event(), vital({ lcp: 1000 })],
        "2026-10-29",
      );
      expect(rows.map((row) => row.metric)).toEqual(["lcp"]);
    });
  });
});
