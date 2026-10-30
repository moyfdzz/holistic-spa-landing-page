/**
 * Number and date formats of the admin panel: Spanish (Mexico), days in the time zone of the
 * business. Pure functions.
 * @module server/admin/format
 */

const numberFormat = new Intl.NumberFormat("es-MX");
const decimalFormat = new Intl.NumberFormat("es-MX", {
  maximumFractionDigits: 1,
});

/**
 * Days are keys like `2026-10-29` (already Monterrey days), so they are formatted as UTC dates
 * to keep the day from moving.
 * @param {Intl.DateTimeFormatOptions} options - What to show.
 * @returns {Intl.DateTimeFormat} The formatter.
 */
const dayFormat = (options) =>
  new Intl.DateTimeFormat("es-MX", { ...options, timeZone: "UTC" });

const shortDay = dayFormat({ day: "numeric", month: "short" });
const longDay = dayFormat({ day: "numeric", month: "long", year: "numeric" });
const monthYear = dayFormat({ month: "short", year: "numeric" });

/**
 * @param {string} day - A day as `YYYY-MM-DD`.
 * @returns {Date} That day at noon UTC.
 */
const toDate = (day) => new Date(`${day}T12:00:00Z`);

/**
 * Writes a count with thousands separators.
 * @param {number} value - The count.
 * @returns {string} For example `12,345`.
 */
export function formatCount(value) {
  return numberFormat.format(value);
}

/**
 * Writes a number with at most one decimal.
 * @param {number} value - The number.
 * @returns {string} For example `3.2`.
 */
export function formatDecimal(value) {
  return decimalFormat.format(value);
}

/**
 * Writes a ratio as a percentage.
 * @param {number} ratio - From 0 to 1 (more is allowed).
 * @returns {string} For example `3.2 %`.
 */
export function formatPercent(ratio) {
  return `${decimalFormat.format(ratio * 100)}\u00a0%`;
}

/**
 * Writes a duration in the largest units that matter.
 * @param {number} seconds - The duration.
 * @returns {string} For example `45 s`, `3 min 5 s` or `1 h 5 min`, with a no-break space between a
 * number and its unit so a line never ends between them.
 */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}\u00a0s`;
  if (total < 3600) {
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    return rest === 0
      ? `${minutes}\u00a0min`
      : `${minutes}\u00a0min ${rest}\u00a0s`;
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return minutes === 0
    ? `${hours}\u00a0h`
    : `${hours}\u00a0h ${minutes}\u00a0min`;
}

/**
 * Writes a day.
 * @param {string} day - The day as `YYYY-MM-DD`.
 * @param {"short" | "long"} [style] - `short` is `29 oct`, `long` is `29 de octubre de 2026`.
 * @returns {string} The text.
 */
export function formatDay(day, style = "short") {
  return (style === "long" ? longDay : shortDay).format(toDate(day));
}

/**
 * Names a bucket of the series.
 * @param {string} bucket - The first day of the bucket, `YYYY-MM-DD`.
 * @param {"day" | "week" | "month" | "year"} granularity - How the series is grouped.
 * @returns {string} For example `29 oct`, `Semana del 26 oct`, `oct 2026` or `2026`.
 */
export function formatBucket(bucket, granularity) {
  if (granularity === "day") return formatDay(bucket);
  if (granularity === "week") return `Semana del ${formatDay(bucket)}`;
  if (granularity === "month") return monthYear.format(toDate(bucket));
  return bucket.slice(0, 4);
}

/**
 * Names a bucket on the horizontal axis of a chart, where space is short.
 * @param {string} bucket - The first day of the bucket, `YYYY-MM-DD`.
 * @param {"day" | "week" | "month" | "year"} granularity - How the series is grouped.
 * @returns {string} For example `29 oct` (a week shows its first day), `oct 2026` or `2026`.
 */
export function formatAxisBucket(bucket, granularity) {
  if (granularity === "day" || granularity === "week") return formatDay(bucket);
  return formatBucket(bucket, granularity);
}
