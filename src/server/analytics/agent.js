/**
 * Turns a user agent into a few categories, so the full string is never stored.
 * @module server/analytics/agent
 */

const botPattern =
  /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|preview|monitor|uptime|curl\/|wget|python-requests|httpclient|axios|node-fetch|go-http|java\//i;

/**
 * Tells whether a user agent looks like a robot (or is missing).
 * @param {string | null | undefined} userAgent - The `User-Agent` header.
 * @returns {boolean} True for bots and empty user agents.
 */
export function isBot(userAgent) {
  return !userAgent || botPattern.test(userAgent);
}

/**
 * Classifies a user agent.
 * @param {string} userAgent - The `User-Agent` header.
 * @returns {{ device: "mobile" | "tablet" | "desktop", browser: string, os: string }} The categories.
 */
export function parseUserAgent(userAgent) {
  const ua = userAgent ?? "";
  const tablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua);
  const mobile = /Mobi|iPhone|iPod|Android.*Mobile/i.test(ua);
  const device = tablet ? "tablet" : mobile ? "mobile" : "desktop";

  let browser = "Other";
  if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet";
  else if (/Edg(e|A|iOS)?\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Firefox|FxiOS/i.test(ua)) browser = "Firefox";
  else if (/Chrome|CriOS/i.test(ua)) browser = "Chrome";
  else if (/Safari/i.test(ua)) browser = "Safari";

  let os = "Other";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux|X11/i.test(ua)) os = "Linux";

  return { device, browser, os };
}
