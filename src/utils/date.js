/**
 * Date helpers.
 * @module utils/date
 */

/**
 * Returns how many whole calendar years have passed since a start year.
 * Used to show "since 2017" style badges without editing the number every year.
 * @param {number} startYear - The year the business started, for example 2017.
 * @param {Date} [now] - The date to measure against. Defaults to today.
 * @returns {number} Whole years between `startYear` and the year of `now`.
 * @throws {TypeError} If `startYear` is not an integer.
 * @throws {RangeError} If `startYear` is in the future.
 */
export function getYearsSince(startYear, now = new Date()) {
  if (!Number.isInteger(startYear)) {
    throw new TypeError("startYear must be an integer, for example 2017");
  }

  const currentYear = now.getFullYear();
  if (startYear > currentYear) {
    throw new RangeError(`startYear ${startYear} is in the future`);
  }

  return currentYear - startYear;
}

/**
 * Formats a 24-hour time for people.
 * Spanish uses the 24-hour clock (`8:00`, `22:00`); English uses am and pm (`8:00 am`, `10:00 pm`).
 * @param {string} time - Time as `HH:MM`, for example `08:00`.
 * @param {"es" | "en"} lang - Language of the result.
 * @returns {string} The time ready to show.
 * @throws {TypeError} If `time` is not `HH:MM`.
 */
export function formatHour(time, lang) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new TypeError("time must look like 08:00");
  const hour = Number(match[1]);
  const minutes = match[2];
  if (lang === "es") return `${hour}:${minutes}`;
  const suffix = hour >= 12 ? "pm" : "am";
  return `${hour % 12 || 12}:${minutes} ${suffix}`;
}
