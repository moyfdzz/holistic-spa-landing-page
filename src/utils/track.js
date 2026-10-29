/**
 * Lets any script or island report an analytics event without knowing how it is sent.
 * The tracker (`scripts/analytics.js`) listens for it. When the tracker is not running
 * (tests, Do Not Track, local runs) nothing happens.
 * @module utils/track
 */

/** Name of the browser event the tracker listens for. */
export const TRACK_EVENT = "analytics:track";

/**
 * Reports an event. Never include personal data or anything the visitor typed.
 * @param {string} type - Event name, one of the names in docs/analytics.md.
 * @param {Record<string, string | number | boolean>} [props] - A few short values.
 * @returns {void}
 */
export function track(type, props) {
  if (typeof document === "undefined") return;
  document.dispatchEvent(
    new CustomEvent(TRACK_EVENT, { detail: { type, props } }),
  );
}
