import { describe, expect, it } from "vitest";
import { computeDailyRollup, splitSessions } from "./rollup.js";

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
