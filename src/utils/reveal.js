/**
 * Reveal-on-scroll animation, a small replacement for the ScrollReveal library.
 * Elements with a `data-reveal` attribute fade in when they enter the viewport.
 * @module utils/reveal
 */

/**
 * Marks every `[data-reveal]` element as visible as it scrolls into view.
 * Everything is shown immediately when the browser has no IntersectionObserver
 * or the visitor prefers reduced motion.
 * @param {ParentNode} [root] - Where to look for `[data-reveal]` elements. Defaults to the document.
 * @param {IntersectionObserverInit} [options] - Observer options (threshold and root margin).
 * @returns {IntersectionObserver | null} The observer, or null when everything was shown at once.
 */
export function initReveal(
  root = document,
  options = { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
) {
  const items = Array.from(root.querySelectorAll("[data-reveal]"));
  if (items.length === 0) return null;

  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduceMotion || typeof IntersectionObserver === "undefined") {
    items.forEach((el) => el.classList.add("is-visible"));
    return null;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    }
  }, options);

  items.forEach((el) => observer.observe(el));
  return observer;
}
