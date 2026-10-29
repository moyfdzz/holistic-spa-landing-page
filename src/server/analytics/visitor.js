/**
 * Anonymous visitor ids. The id is a hash that includes a secret salt that changes every day
 * and is deleted afterwards, so a person cannot be followed across days and the IP address
 * is never stored.
 * @module server/analytics/visitor
 */

/**
 * Day key (UTC) used to pick the salt.
 * @param {Date} date - A moment in time.
 * @returns {string} The day as `YYYY-MM-DD`.
 */
export function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Creates a random salt.
 * @returns {string} 32 random bytes as hexadecimal.
 */
export function newSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

/**
 * Hashes the daily salt with what identifies a browser for one day.
 * @param {object} input - The ingredients.
 * @param {string} input.salt - The salt of the day.
 * @param {string} input.ip - The IP address (used only here, never stored).
 * @param {string} input.userAgent - The user agent.
 * @param {string} input.siteHost - Host of the site.
 * @returns {Promise<string>} A 32-character hexadecimal id.
 */
export async function hashVisitor({ salt, ip, userAgent, siteHost }) {
  const data = new TextEncoder().encode(
    [salt, ip, userAgent, siteHost].join("|"),
  );
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  )
    .join("")
    .slice(0, 32);
}
