/**
 * Daily totals computed from the raw events of one day. Pure functions: no input or output.
 * @module server/analytics/rollup
 */

/** Minutes without events after which the same visitor starts a new session. */
export const SESSION_GAP_MINUTES = 30;

/** A session with one page view and less engaged time than this (seconds) counts as a bounce. */
export const BOUNCE_SECONDS = 10;

/**
 * @typedef {object} EventRow
 * @property {string} visitorId - Anonymous id of the day.
 * @property {Date} occurredAt - When it happened.
 * @property {string} type - Event name.
 * @property {string} path - Page path.
 * @property {string} locale - `es` or `en`.
 * @property {string} channel - Where the visit came from.
 * @property {string | null} referrerHost - Referrer host.
 * @property {string | null} country - Country code.
 * @property {string | null} region - State.
 * @property {string | null} city - City.
 * @property {string} device - Device category.
 * @property {string} browser - Browser category.
 * @property {string} os - OS category.
 * @property {unknown} props - Extra short values of the event.
 */

/**
 * @typedef {object} DailyRow
 * @property {string} day - The day as `YYYY-MM-DD`.
 * @property {string} dimension - What the row groups by (`total`, `channel`, `path`...).
 * @property {string} key - The value inside the dimension.
 * @property {number} visitors - Distinct visitors.
 * @property {number} sessions - Sessions that started with this value.
 * @property {number} pageViews - Page views.
 * @property {number} events - Events.
 * @property {number} engagedSeconds - Seconds with the page visible.
 * @property {number} bounces - Sessions with one page view and almost no engaged time.
 */

/** Columns of the events that become a dimension of page views and sessions. */
const eventDimensions = /** @type {const} */ ([
  ["channel", "channel"],
  ["referrer_host", "referrerHost"],
  ["country", "country"],
  ["region", "region"],
  ["city", "city"],
  ["device", "device"],
  ["browser", "browser"],
  ["os", "os"],
  ["locale", "locale"],
]);

/** Event types whose `props` value becomes a dimension, as `[dimension, type, prop]`. */
const propDimensions = /** @type {const} */ ([
  ["section", "section_view", "section"],
  ["service", "service_card_view", "id"],
  ["faq", "faq_open", "id"],
  ["whatsapp", "whatsapp_click", "placement"],
]);

/**
 * Reads a short value out of the props of an event.
 * @param {unknown} props - The props.
 * @param {string} name - The name of the value.
 * @returns {string | number | null} The value, or null.
 */
function prop(props, name) {
  if (typeof props !== "object" || props === null) return null;
  const value = /** @type {Record<string, unknown>} */ (props)[name];
  return typeof value === "string" || typeof value === "number" ? value : null;
}

/**
 * Groups the events of each visitor into sessions: a new one starts after 30 minutes of silence.
 * @param {EventRow[]} events - The events of one day.
 * @returns {EventRow[][]} The sessions, each with its events in time order.
 */
export function splitSessions(events) {
  /** @type {Map<string, EventRow[]>} */
  const byVisitor = new Map();
  for (const event of events) {
    const list = byVisitor.get(event.visitorId) ?? [];
    list.push(event);
    byVisitor.set(event.visitorId, list);
  }
  /** @type {EventRow[][]} */
  const sessions = [];
  for (const list of byVisitor.values()) {
    list.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
    /** @type {EventRow[]} */
    let current = [];
    for (const event of list) {
      const last = current[current.length - 1];
      const gap = last
        ? (event.occurredAt.getTime() - last.occurredAt.getTime()) / 60000
        : 0;
      if (last && gap > SESSION_GAP_MINUTES) {
        sessions.push(current);
        current = [];
      }
      current.push(event);
    }
    if (current.length > 0) sessions.push(current);
  }
  return sessions;
}

/**
 * Computes every daily row for one day.
 * @param {EventRow[]} events - All the events of the day (already limited to that day).
 * @param {string} day - The day as `YYYY-MM-DD`.
 * @returns {DailyRow[]} The rows, sorted by dimension and key so the result is stable.
 */
export function computeDailyRollup(events, day) {
  /** @type {Map<string, DailyRow>} */
  const rows = new Map();
  /** @type {Map<string, Set<string>>} */
  const visitorSets = new Map();

  /**
   * Gets (or creates) a row.
   * @param {string} dimension - The dimension.
   * @param {string} key - The value.
   * @returns {DailyRow} The row.
   */
  const row = (dimension, key) => {
    const id = `${dimension}\u0000${key}`;
    let found = rows.get(id);
    if (!found) {
      found = {
        day,
        dimension,
        key,
        visitors: 0,
        sessions: 0,
        pageViews: 0,
        events: 0,
        engagedSeconds: 0,
        bounces: 0,
      };
      rows.set(id, found);
    }
    return found;
  };

  /**
   * Counts a visitor once per row.
   * @param {string} dimension - The dimension.
   * @param {string} key - The value.
   * @param {string} visitorId - The visitor.
   */
  const addVisitor = (dimension, key, visitorId) => {
    const id = `${dimension}\u0000${key}`;
    const set = visitorSets.get(id) ?? new Set();
    if (!set.has(visitorId)) {
      set.add(visitorId);
      visitorSets.set(id, set);
      row(dimension, key).visitors += 1;
    }
  };

  const total = row("total", "");
  for (const event of events) {
    addVisitor("total", "", event.visitorId);
    total.events += 1;
    row("event", event.type).events += 1;
    addVisitor("event", event.type, event.visitorId);

    if (event.type === "page_view") {
      total.pageViews += 1;
      row("path", event.path).pageViews += 1;
      addVisitor("path", event.path, event.visitorId);
      for (const [dimension, column] of eventDimensions) {
        const key = String(event[column] ?? "(unknown)");
        row(dimension, key).pageViews += 1;
        addVisitor(dimension, key, event.visitorId);
      }
    }
    if (event.type === "engagement") {
      const seconds = prop(event.props, "seconds");
      if (typeof seconds === "number" && seconds > 0)
        total.engagedSeconds += Math.round(seconds);
    }
    for (const [dimension, type, name] of propDimensions) {
      if (event.type !== type) continue;
      const key = String(prop(event.props, name) ?? "(unknown)");
      row(dimension, key).events += 1;
      addVisitor(dimension, key, event.visitorId);
    }
  }

  for (const session of splitSessions(events)) {
    const landing =
      session.find((event) => event.type === "page_view") ?? session[0];
    const views = session.filter((event) => event.type === "page_view").length;
    const engaged = session.reduce((sum, event) => {
      const seconds =
        event.type === "engagement" ? prop(event.props, "seconds") : null;
      return sum + (typeof seconds === "number" ? seconds : 0);
    }, 0);
    const bounced = views <= 1 && engaged < BOUNCE_SECONDS;
    total.sessions += 1;
    if (bounced) total.bounces += 1;
    for (const [dimension, column] of eventDimensions) {
      const target = row(dimension, String(landing[column] ?? "(unknown)"));
      target.sessions += 1;
      if (bounced) target.bounces += 1;
    }
    const path = row("path", landing.path);
    path.sessions += 1;
    if (bounced) path.bounces += 1;
  }

  return [...rows.values()].sort(
    (a, b) =>
      a.dimension.localeCompare(b.dimension) || a.key.localeCompare(b.key),
  );
}
