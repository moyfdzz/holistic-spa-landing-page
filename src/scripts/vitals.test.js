import { beforeEach, describe, expect, it } from "vitest";
import { watchVitals } from "./vitals.js";

/**
 * A fake `PerformanceObserver` that keeps the callbacks by entry type, so a test can feed entries.
 * @param {string[]} [unsupported] - Entry types the browser refuses to observe.
 * @returns {{ win: Window & typeof globalThis, emit: (type: string, entries: object[]) => void, options: Record<string, object>, navigation: { responseStart: number } | null }} The fake window and helpers.
 */
function fakeWindow(unsupported = []) {
  /** @type {Record<string, (list: { getEntries: () => object[] }) => void>} */
  const callbacks = {};
  /** @type {Record<string, object>} */
  const options = {};
  const state = {
    navigation: /** @type {{ responseStart: number } | null} */ (null),
  };
  class FakeObserver {
    /** @param {(list: { getEntries: () => object[] }) => void} callback - Called with entries. */
    constructor(callback) {
      this.callback = callback;
    }
    /** @param {{ type: string }} init - What to watch. */
    observe(init) {
      if (unsupported.includes(init.type)) throw new TypeError("unsupported");
      callbacks[init.type] = this.callback;
      options[init.type] = init;
    }
  }
  const win = /** @type {Window & typeof globalThis} */ (
    /** @type {unknown} */ ({
      PerformanceObserver: FakeObserver,
      performance: {
        getEntriesByType: () => (state.navigation ? [state.navigation] : []),
      },
    })
  );

  return {
    win,
    options,
    get navigation() {
      return state.navigation;
    },
    set navigation(value) {
      state.navigation = value;
    },
    emit: (type, entries) => callbacks[type]?.({ getEntries: () => entries }),
  };
}

describe("watchVitals", () => {
  /** @type {ReturnType<typeof fakeWindow>} */
  let fake;
  beforeEach(() => {
    fake = fakeWindow();
  });

  it("measures nothing until the browser reports something", () => {
    expect(watchVitals(fake.win)()).toEqual({});
  });

  it("reads the first contentful paint and the latest largest contentful paint", () => {
    const read = watchVitals(fake.win);
    fake.emit("paint", [
      { name: "first-paint", startTime: 100 },
      { name: "first-contentful-paint", startTime: 812.4 },
    ]);
    fake.emit("largest-contentful-paint", [{ startTime: 900 }]);
    fake.emit("largest-contentful-paint", [{ startTime: 1530.6 }]);
    expect(read()).toEqual({ fcp: 812, lcp: 1531 });
  });

  it("reads the time to first byte from the navigation entry", () => {
    const read = watchVitals(fake.win);
    fake.navigation = { responseStart: 215.7 };
    expect(read()).toEqual({ ttfb: 216 });
  });

  it("ignores a navigation entry with no response yet", () => {
    const read = watchVitals(fake.win);
    fake.navigation = { responseStart: 0 };
    expect(read()).toEqual({});
  });

  it("adds layout shifts of a window and ignores the ones right after an input", () => {
    const read = watchVitals(fake.win);
    fake.emit("layout-shift", [
      { startTime: 1000, value: 0.04 },
      { startTime: 1500, value: 0.03 },
      { startTime: 1600, value: 0.5, hadRecentInput: true },
    ]);
    expect(read()).toEqual({ cls: 0.07 });
  });

  it("keeps the worst window of layout shifts, not the sum of all of them", () => {
    const read = watchVitals(fake.win);
    fake.emit("layout-shift", [
      { startTime: 1000, value: 0.05 },
      // More than a second later: a new window.
      { startTime: 3000, value: 0.02 },
      { startTime: 3500, value: 0.01 },
    ]);
    expect(read()).toEqual({ cls: 0.05 });
  });

  it("starts a new window after 5 seconds even with shifts less than a second apart", () => {
    const read = watchVitals(fake.win);
    const entries = [];
    for (let t = 0; t <= 6000; t += 900)
      entries.push({ startTime: t, value: 0.01 });
    fake.emit("layout-shift", entries);
    // The window of the first 5 s holds six shifts (0 to 4500), the next one holds the rest.
    expect(read().cls).toBe(0.06);
  });

  it("takes the slowest interaction as the interaction to next paint", () => {
    const read = watchVitals(fake.win);
    fake.emit("event", [
      { interactionId: 1, duration: 80 },
      { interactionId: 1, duration: 120 },
      { interactionId: 2, duration: 64 },
      { interactionId: 0, duration: 900 },
    ]);
    expect(read()).toEqual({ inp: 120 });
  });

  it("asks the browser for the events slower than 40 ms and for buffered entries", () => {
    watchVitals(fake.win);
    expect(fake.options.event).toMatchObject({
      durationThreshold: 40,
      buffered: true,
    });
    expect(fake.options.paint).toMatchObject({ buffered: true });
  });

  it("uses the 98th percentile when there are many interactions", () => {
    const read = watchVitals(fake.win);
    const entries = Array.from({ length: 100 }, (_, index) => ({
      interactionId: index + 1,
      duration: 100 + index,
    }));
    fake.emit("event", entries);
    // One interaction is ignored for every 50: with 100 the two slowest (199 and 198 ms) are
    // skipped and the answer is the third.
    expect(read().inp).toBe(197);
  });

  it("leaves out a measure the browser does not support and keeps the rest", () => {
    fake = fakeWindow(["layout-shift", "event", "largest-contentful-paint"]);
    const read = watchVitals(fake.win);
    fake.emit("paint", [{ name: "first-contentful-paint", startTime: 500 }]);
    expect(read()).toEqual({ fcp: 500 });
  });
});
