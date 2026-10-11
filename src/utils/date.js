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
