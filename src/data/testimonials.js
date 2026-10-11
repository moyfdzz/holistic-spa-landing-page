/**
 * Client testimonials.
 *
 * Only add REAL testimonials from clients who gave their permission, and set
 * `consent: true`. Use the first name and the initial of the last name only
 * (for example "Ana G."), and no photos unless the client allows it. Entries
 * without `consent: true` are never shown. While the list is empty, the whole
 * section is hidden.
 * @module data/testimonials
 */

/**
 * @typedef {object} Testimonial
 * @property {string} id - Stable id.
 * @property {string} author - First name and initial, for example `Ana G.`.
 * @property {number} rating - Whole number of stars, from 1 to 5.
 * @property {string} [serviceSlug] - Slug of the service the client received, from `src/data/services.js`.
 * @property {string} date - Date of the review, as `YYYY-MM-DD`.
 * @property {"es" | "en"} originalLang - Language the client wrote in.
 * @property {{ es: string, en: string }} quote - The testimonial in both languages (the original and its translation).
 * @property {boolean} consent - True only when the client agreed to be quoted.
 */

/** @type {Testimonial[]} */
export const testimonials = [];

/**
 * Returns the testimonials that may be shown: the ones with the client's consent, newest first.
 * @param {Testimonial[]} list - All testimonials.
 * @returns {Testimonial[]} The publishable testimonials.
 */
export function getPublishedTestimonials(list) {
  return list
    .filter((item) => item.consent === true)
    .sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * Checks a testimonial and describes what is wrong with it.
 * @param {Testimonial} item - The testimonial to check.
 * @returns {string[]} A list of problems. Empty when the testimonial is fine.
 */
export function validateTestimonial(item) {
  const problems = [];
  if (!/^[A-ZÁÉÍÓÚÑ][\p{L}]+ [A-ZÁÉÍÓÚÑ]\.$/u.test(item.author)) {
    problems.push("author must be a first name and an initial, like Ana G.");
  }
  if (!Number.isInteger(item.rating) || item.rating < 1 || item.rating > 5) {
    problems.push("rating must be a whole number from 1 to 5");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
    problems.push("date must look like 2026-10-11");
  }
  if (!item.quote.es.trim() || !item.quote.en.trim()) {
    problems.push("quote needs a Spanish and an English text");
  }
  if (item.consent !== true) problems.push("the client's consent is required");
  return problems;
}
