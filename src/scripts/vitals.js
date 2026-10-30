/**
 * Real-user speed (Core Web Vitals) for the anonymous tracker. It only reads the browser's own
 * performance entries, keeps numbers in memory and hands them over once, when the page is hidden.
 * @module scripts/vitals
 */

/** Share of page views that report their speed (1 is all of them). Lower it if traffic grows. */
export const VITALS_SAMPLE_RATE = 1;

/**
 * @typedef {PerformanceEntry & { value?: number, hadRecentInput?: boolean, interactionId?: number }} VitalEntry
 * An entry of any of the types watched here: they share these few fields.
 */

/**
 * Starts watching the speed of the page.
 * @param {Window & typeof globalThis} win - The window.
 * @returns {() => Record<string, number>} A function that gives what was measured so far:
 * `lcp`, `inp`, `fcp` and `ttfb` in milliseconds and `cls` as a score. A measure the browser
 * does not support is missing.
 */
export function watchVitals(win) {
  /** @type {Record<string, number>} */
  const out = {};
  /** @type {Map<number, number>} */
  const interactions = new Map();
  let shift = { value: 0, first: 0, last: 0 };

  /**
   * @param {string} type - Entry type to observe.
   * @param {(entry: VitalEntry) => void} onEntry - Called for each entry.
   * @param {object} [extra] - More options of the observer.
   */
  const observe = (type, onEntry, extra) => {
    try {
      new win.PerformanceObserver((list) =>
        list.getEntries().forEach(onEntry),
      ).observe({
        type,
        buffered: true,
        ...extra,
      });
    } catch {
      // The browser does not support this entry type: that measure stays missing.
    }
  };

  observe("paint", (entry) => {
    if (entry.name === "first-contentful-paint") out.fcp = entry.startTime;
  });
  observe("largest-contentful-paint", (entry) => {
    out.lcp = entry.startTime;
  });
  // Layout shifts are grouped in windows (at most 5 s, with less than 1 s between shifts); the
  // score is the worst window.
  observe("layout-shift", (entry) => {
    if (entry.hadRecentInput) return;
    const t = entry.startTime;
    if (t - shift.last > 1000 || t - shift.first > 5000)
      shift = { value: 0, first: t, last: t };
    shift.value += entry.value ?? 0;
    shift.last = t;
    out.cls = Math.max(out.cls ?? 0, shift.value);
  });
  // The slowest interaction (the 98th percentile once there are many).
  observe(
    "event",
    (entry) => {
      if (!entry.interactionId) return;
      const id = entry.interactionId;
      interactions.set(id, Math.max(interactions.get(id) ?? 0, entry.duration));
    },
    { durationThreshold: 40 },
  );

  return () => {
    const nav = /** @type {PerformanceNavigationTiming | undefined} */ (
      win.performance?.getEntriesByType?.("navigation")?.[0]
    );
    if (nav && nav.responseStart > 0) out.ttfb = nav.responseStart;
    if (interactions.size > 0) {
      const slowest = [...interactions.values()].sort((a, b) => b - a);
      out.inp =
        slowest[Math.min(Math.floor(slowest.length / 50), slowest.length - 1)];
    }
    return Object.fromEntries(
      Object.entries(out).map(([name, value]) => [
        name,
        name === "cls" ? Math.round(value * 1000) / 1000 : Math.round(value),
      ]),
    );
  };
}
