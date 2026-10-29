/**
 * Works out where a visit came from. UTM parameters win; otherwise the referrer host decides.
 * @module server/analytics/source
 */

/** Channels a visit can be attributed to. */
export const channels = /** @type {const} */ ([
  "google_maps",
  "google_search",
  "bing",
  "instagram",
  "facebook",
  "whatsapp",
  "other_site",
  "direct",
  "internal",
  "campaign",
]);

/** @typedef {typeof channels[number]} Channel */

/**
 * Maps a UTM source and medium to a channel.
 * @param {string} source - Lowercased `utm_source`.
 * @param {string} medium - Lowercased `utm_medium`.
 * @returns {Channel} The channel.
 */
function fromUtm(source, medium) {
  if (source.includes("google") && /maps|gbp|business|ficha/.test(medium))
    return "google_maps";
  if (source.includes("google")) return "google_search";
  if (source.includes("instagram")) return "instagram";
  if (source.includes("facebook")) return "facebook";
  if (source.includes("whatsapp")) return "whatsapp";
  if (source.includes("bing")) return "bing";
  return "campaign";
}

/**
 * Maps a referrer host to a channel.
 * @param {string} host - Lowercased referrer host.
 * @returns {Channel} The channel.
 */
function fromHost(host) {
  if (/^maps\.google\./.test(host)) return "google_maps";
  if (/(^|\.)google\.[a-z.]+$/.test(host)) return "google_search";
  if (/(^|\.)bing\.com$/.test(host)) return "bing";
  if (/(^|\.)instagram\.com$/.test(host)) return "instagram";
  if (/(^|\.)(facebook\.com|fb\.com)$/.test(host)) return "facebook";
  if (/(^|\.)(whatsapp\.com|wa\.me)$/.test(host)) return "whatsapp";
  return "other_site";
}

/**
 * Returns the host of a referrer, or an empty string when it is missing or invalid.
 * @param {string | undefined} referrer - The referrer as sent by the browser.
 * @returns {string} The lowercased host without `www.`.
 */
export function referrerHost(referrer) {
  if (!referrer) return "";
  try {
    return new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * Classifies a visit.
 * @param {object} input - What is known about the visit.
 * @param {string} [input.utmSource] - `utm_source` of the landing address.
 * @param {string} [input.utmMedium] - `utm_medium` of the landing address.
 * @param {string} [input.referrer] - The referrer.
 * @param {string} input.siteHost - Host of this site, to recognize internal navigation.
 * @returns {{ channel: Channel, referrerHost: string }} The channel and the referrer host (empty if none).
 */
export function classifySource({ utmSource, utmMedium, referrer, siteHost }) {
  const host = referrerHost(referrer);
  const source = (utmSource ?? "").trim().toLowerCase();
  if (source) {
    return {
      channel: fromUtm(source, (utmMedium ?? "").trim().toLowerCase()),
      referrerHost: host,
    };
  }
  if (!host) return { channel: "direct", referrerHost: "" };
  const own = siteHost.toLowerCase().replace(/^www\./, "");
  if (host === own) return { channel: "internal", referrerHost: host };
  return { channel: fromHost(host), referrerHost: host };
}
