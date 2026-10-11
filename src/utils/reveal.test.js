import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initReveal } from "./reveal.js";

/** @type {((entries: Partial<IntersectionObserverEntry>[]) => void) | undefined} */
let trigger;
const observe = vi.fn();
const unobserve = vi.fn();

/**
 * Minimal IntersectionObserver double that lets the test fire intersections.
 */
class FakeObserver {
  /** @param {(entries: Partial<IntersectionObserverEntry>[]) => void} callback - Observer callback. */
  constructor(callback) {
    trigger = callback;
  }
  observe = observe;
  unobserve = unobserve;
}

/**
 * Pretends the visitor does or does not prefer reduced motion.
 * @param {boolean} reduce - Value of the media query.
 */
function setReducedMotion(reduce) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: reduce });
}

describe("initReveal", () => {
  beforeEach(() => {
    document.body.innerHTML = `<p data-reveal id="one">One</p><p data-reveal id="two">Two</p>`;
    vi.stubGlobal("IntersectionObserver", FakeObserver);
    setReducedMotion(false);
    observe.mockClear();
    unobserve.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when there is nothing to reveal", () => {
    document.body.innerHTML = "<p>Plain</p>";
    expect(initReveal()).toBeNull();
  });

  it("observes every element and reveals it when it intersects", () => {
    expect(initReveal()).not.toBeNull();
    expect(observe).toHaveBeenCalledTimes(2);

    const one = /** @type {Element} */ (document.getElementById("one"));
    trigger?.([{ isIntersecting: false, target: one }]);
    expect(one.classList.contains("is-visible")).toBe(false);

    trigger?.([{ isIntersecting: true, target: one }]);
    expect(one.classList.contains("is-visible")).toBe(true);
    expect(unobserve).toHaveBeenCalledWith(one);
  });

  it("shows everything at once when the visitor prefers reduced motion", () => {
    setReducedMotion(true);
    expect(initReveal()).toBeNull();
    expect(document.querySelectorAll(".is-visible")).toHaveLength(2);
    expect(observe).not.toHaveBeenCalled();
  });

  it("shows everything at once without IntersectionObserver support", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    expect(initReveal()).toBeNull();
    expect(document.querySelectorAll(".is-visible")).toHaveLength(2);
  });
});
