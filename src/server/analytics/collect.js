/**
 * Turns a tracker request into the row to store, or decides to drop it.
 * Pure function: it does no input or output, so it is easy to test.
 * @module server/analytics/collect
 */
import { isBot, parseUserAgent } from "./agent.js";
import { collectBodySchema, screenBucket } from "./events.js";
import { classifySource } from "./source.js";
import { hashVisitor } from "./visitor.js";

/**
 * @typedef {typeof import("../db/schema.js").analyticsEvents.$inferInsert} EventRow
 * A row of `analytics_events`.
 */

/**
 * @typedef {object} CollectInput
 * @property {unknown} body - The parsed JSON body.
 * @property {Headers} headers - The request headers.
 * @property {{ country?: string, region?: string, city?: string } | undefined} cf - Location data from Cloudflare.
 * @property {string} siteHost - Host of the production site.
 * @property {() => Promise<string>} getSalt - Returns the salt of the day. Called only for events that will be stored, so ignored requests never touch the database.
 * @property {Date} now - The current time.
 */

/**
 * Cuts a text to a maximum length.
 * @param {string | undefined} value - The text.
 * @param {number} max - Maximum length.
 * @returns {string | null} The cut text, or null when empty.
 */
function clean(value, max) {
  const text = (value ?? "").trim().slice(0, max);
  return text || null;
}

/**
 * Builds the row for one event.
 * @param {CollectInput} input - The request data.
 * @returns {Promise<{ row: EventRow } | { dropped: "origin" | "privacy" | "bot" | "invalid" }>} The row, or why it was dropped.
 */
export async function buildEventRow({
  body,
  headers,
  cf,
  siteHost,
  getSalt,
  now,
}) {
  // Only requests that come from this site count (not previews, local runs or other sites).
  const originHost = (() => {
    try {
      return new URL(headers.get("origin") ?? "").hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (originHost !== siteHost.toLowerCase()) return { dropped: "origin" };

  // Respect Do Not Track and Global Privacy Control.
  if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1")
    return { dropped: "privacy" };

  const userAgent = headers.get("user-agent") ?? "";
  if (isBot(userAgent)) return { dropped: "bot" };

  const parsed = collectBodySchema.safeParse(body);
  if (!parsed.success) return { dropped: "invalid" };
  const event = parsed.data;

  const { channel, referrerHost } = classifySource({
    utmSource: event.utmSource,
    utmMedium: event.utmMedium,
    referrer: event.referrer,
    siteHost,
  });
  const agent = parseUserAgent(userAgent);
  const ip = headers.get("cf-connecting-ip") ?? "";

  return {
    row: {
      occurredAt: now,
      visitorId: await hashVisitor({
        salt: await getSalt(),
        ip,
        userAgent,
        siteHost,
      }),
      type: event.type,
      path: event.path,
      locale: event.locale,
      channel,
      referrerHost: clean(referrerHost, 100),
      utmSource: clean(event.utmSource, 80),
      utmMedium: clean(event.utmMedium, 80),
      utmCampaign: clean(event.utmCampaign, 80),
      country: clean(cf?.country, 2),
      region: clean(cf?.region, 80),
      city: clean(cf?.city, 80),
      device: agent.device,
      browser: agent.browser,
      os: agent.os,
      screen: screenBucket(event.screenWidth),
      props: event.props ?? null,
    },
  };
}
