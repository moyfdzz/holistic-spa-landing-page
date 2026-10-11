/**
 * Keeps the "more than N years" text current without a new build.
 * @module scripts/years-since
 */
import { getYearsSince } from "../utils/date.js";

/**
 * Updates every element with a `data-years-since="YEAR"` attribute so its text
 * is the number of whole years since that year. The build already writes the
 * right number, so this only matters when the page is older than a year.
 * @param {ParentNode} [root] - Where to look for elements. Defaults to the document.
 * @param {Date} [now] - The date to measure against. Defaults to today.
 * @returns {number} How many elements were updated.
 */
export function initYearsSince(root = document, now = new Date()) {
  let updated = 0;
  root.querySelectorAll("[data-years-since]").forEach((el) => {
    try {
      const year = Number(el.getAttribute("data-years-since"));
      el.textContent = String(getYearsSince(year, now));
      updated += 1;
    } catch {
      // Invalid year: keep the number written at build time.
    }
  });
  return updated;
}
