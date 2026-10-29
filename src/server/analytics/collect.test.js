import { describe, expect, it } from "vitest";
import { buildEventRow } from "./collect.js";
import { collectBodySchema, screenBucket } from "./events.js";

const chrome =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const siteHost = "www.masajesrelaxmty.com";
const now = new Date("2026-10-29T12:00:00Z");

/**
 * @param {Record<string, string>} [extra] - Headers to add or replace.
 * @returns {Headers} Request headers of a normal visit.
 */
function headers(extra = {}) {
  return new Headers({
    origin: `https://${siteHost}`,
    "user-agent": chrome,
    "cf-connecting-ip": "203.0.113.7",
    ...extra,
  });
}

const body = {
  type: "page_view",
  path: "/contact",
  locale: "es",
  referrer: "https://l.instagram.com/",
  utmSource: "instagram",
  utmMedium: "bio",
  screenWidth: 390,
  props: { placement: "hero" },
};

/**
 * @param {Partial<Parameters<typeof buildEventRow>[0]>} [override] - Input to change.
 * @returns {ReturnType<typeof buildEventRow>} The result.
 */
const run = (override = {}) =>
  buildEventRow({
    body,
    headers: headers(),
    cf: { country: "MX", region: "Nuevo León", city: "Monterrey" },
    siteHost,
    getSalt: async () => "salt",
    now,
    ...override,
  });

describe("buildEventRow", () => {
  it("builds a row with categories and no personal data", async () => {
    const result = await run();
    expect("row" in result).toBe(true);
    if (!("row" in result)) return;
    expect(result.row).toMatchObject({
      type: "page_view",
      path: "/contact",
      locale: "es",
      channel: "instagram",
      referrerHost: "l.instagram.com",
      utmSource: "instagram",
      country: "MX",
      city: "Monterrey",
      device: "desktop",
      browser: "Chrome",
      os: "Windows",
      screen: "small",
      props: { placement: "hero" },
    });
    const text = JSON.stringify(result.row);
    expect(text).not.toContain("203.0.113.7");
    expect(text).not.toContain("Mozilla");
    expect(result.row.visitorId).toMatch(/^[0-9a-f]{32}$/);
  });

  it("drops requests from another origin", async () => {
    const result = await run({
      headers: headers({ origin: "https://example.org" }),
    });
    expect(result).toEqual({ dropped: "origin" });
    expect(await run({ headers: headers({ origin: "" }) })).toEqual({
      dropped: "origin",
    });
  });

  it("drops local runs and workers.dev previews", async () => {
    for (const origin of [
      "http://localhost:4321",
      "https://holistic-spa-landing-page.example.workers.dev",
    ]) {
      expect(await run({ headers: headers({ origin }) })).toEqual({
        dropped: "origin",
      });
    }
  });

  it("respects Do Not Track and Global Privacy Control", async () => {
    expect(await run({ headers: headers({ dnt: "1" }) })).toEqual({
      dropped: "privacy",
    });
    expect(await run({ headers: headers({ "sec-gpc": "1" }) })).toEqual({
      dropped: "privacy",
    });
  });

  it("drops bots", async () => {
    expect(
      await run({ headers: headers({ "user-agent": "Googlebot/2.1" }) }),
    ).toEqual({ dropped: "bot" });
  });

  it("rejects an unknown event type or a bad path", async () => {
    expect(await run({ body: { ...body, type: "hack" } })).toEqual({
      dropped: "invalid",
    });
    expect(await run({ body: { ...body, path: "no-slash" } })).toEqual({
      dropped: "invalid",
    });
    expect(await run({ body: null })).toEqual({ dropped: "invalid" });
  });

  it("gives the same visitor id on the same day and another on the next", async () => {
    const a = await run();
    const b = await run();
    const c = await run({ getSalt: async () => "next-day-salt" });
    if (!("row" in a && "row" in b && "row" in c)) throw new Error("dropped");
    expect(a.row.visitorId).toBe(b.row.visitorId);
    expect(a.row.visitorId).not.toBe(c.row.visitorId);
  });
});

describe("collectBodySchema", () => {
  it("limits the props", () => {
    const many = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [`k${i}`, "v"]),
    );
    expect(collectBodySchema.safeParse({ ...body, props: many }).success).toBe(
      false,
    );
  });

  it("buckets the screen width", () => {
    expect(screenBucket(undefined)).toBe("unknown");
    expect(screenBucket(390)).toBe("small");
    expect(screenBucket(800)).toBe("medium");
    expect(screenBucket(1440)).toBe("large");
  });
});

describe("buildEventRow and the database", () => {
  it("asks for the salt only for events that will be stored", async () => {
    let calls = 0;
    const getSalt = async () => {
      calls += 1;
      return "salt";
    };
    await run({ getSalt, headers: headers({ dnt: "1" }) });
    await run({ getSalt, headers: headers({ origin: "https://example.org" }) });
    await run({ getSalt, headers: headers({ "user-agent": "Googlebot" }) });
    await run({ getSalt, body: { type: "nope" } });
    expect(calls).toBe(0);
    await run({ getSalt });
    expect(calls).toBe(1);
  });
});
