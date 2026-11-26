/**
 * Lets any script or island report an analytics event without knowing how it is sent.
 * The tracker (`scripts/analytics.js`) receives it. An island can be ready before the
 * tracker, so an event nobody has received waits for it. When the tracker is not running
 * (tests, Do Not Track, local runs) nothing is sent.
 * @module utils/track
 */

/** Name of the browser event that carries a report. */
export const TRACK_EVENT = "analytics:track";

/**
 * @typedef {object} TrackedEvent
 * @property {string} type - Event name.
 * @property {Record<string, string | number | boolean>} [props] - A few short values.
 */

/** @type {TrackedEvent[]} Events reported while nothing received them. */
const waiting = [];

/**
 * Reports an event. Never include personal data or anything the visitor typed.
 * @param {string} type - Event name, one of the names in docs/analytics.md.
 * @param {Record<string, string | number | boolean>} [props] - A few short values.
 * @returns {void}
 */
export function track(type, props) {
  if (typeof document === "undefined") return;
  const event = new CustomEvent(TRACK_EVENT, {
    detail: { type, props },
    cancelable: true,
  });
  // A receiver cancels the event to say it took it.
  if (document.dispatchEvent(event)) waiting.push(event.detail);
}

/**
 * Receives every reported event, starting with the ones that were waiting.
 * @param {Document} doc - The document the events are reported on.
 * @param {(event: TrackedEvent) => void} handle - Called once for each event.
 * @returns {void}
 */
export function receiveTracked(doc, handle) {
  doc.addEventListener(TRACK_EVENT, (event) => {
    event.preventDefault();
    handle(/** @type {CustomEvent<TrackedEvent>} */ (event).detail);
  });
  waiting.splice(0).forEach(handle);
}
