/**
 * CSV export of the dashboard tables. Pure functions: no input or output.
 * The keys of the rows (paths, referrer hosts, cities) come from visitors, so a cell that
 * would be read as a formula by a spreadsheet is neutralized.
 * @module server/analytics/csv
 */

/** Marks the file as UTF-8 so Excel shows accents (cities, for example) correctly. */
const BOM = "﻿";

/** Metric columns, as `[header, field]`, in the order shown. */
const metricColumns = /** @type {const} */ ([
  ["visitors", "visitors"],
  ["sessions", "sessions"],
  ["page_views", "pageViews"],
  ["events", "events"],
  ["engaged_seconds", "engagedSeconds"],
  ["bounces", "bounces"],
  ["bounce_rate", "bounceRate"],
  ["avg_engaged_seconds", "avgEngagedSeconds"],
]);

/**
 * Writes one value as a CSV cell.
 * @param {string | number | null | undefined} value - The value.
 * @returns {string} The cell, quoted when it needs to be.
 */
export function csvCell(value) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  // A spreadsheet treats these first characters of a text as the start of a formula. Numbers
  // are ours, never visitor text, so they stay as they are (a negative one is still a number).
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * Builds the CSV of a table.
 * @param {"series" | string} table - `series`, or the name of a dimension.
 * @param {Array<import("./query.js").SeriesPoint | import("./query.js").BreakdownEntry>} rows - The rows.
 * @returns {string} The CSV, with a byte order mark, a header and `\r\n` line ends.
 */
export function toCsv(table, rows) {
  const first = table === "series" ? "bucket" : "key";
  const header = [first, ...metricColumns.map(([name]) => name)].join(",");
  const lines = rows.map((row) => {
    const label = "bucket" in row ? row.bucket : row.key;
    return [
      csvCell(label),
      ...metricColumns.map(([, field]) => csvCell(row[field])),
    ].join(",");
  });
  return `${BOM}${[header, ...lines].join("\r\n")}\r\n`;
}

/**
 * Name of the downloaded file.
 * @param {string} table - The table.
 * @param {{ from: string, to: string }} range - The range.
 * @returns {string} For example `analytics-channel-2026-10-29_2026-11-04.csv`.
 */
export function csvFilename(table, range) {
  return `analytics-${table}-${range.from}_${range.to}.csv`;
}
