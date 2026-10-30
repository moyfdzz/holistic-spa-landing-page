/**
 * Date ranges of the dashboard, in the time zone of the business. Pure functions.
 * @module server/analytics/range
 */
import { z } from "zod";
import { addDays, dayKey } from "./visitor.js";

/** First day with data: the tracker went live on this day. "Todo" starts here. */
export const analyticsLaunchDay = "2026-10-29";

/** The ranges the picker offers. */
export const presets = /** @type {const} */ ([
  "today",
  "7d",
  "30d",
  "month",
  "year",
  "all",
  "custom",
]);

/** Labels in Spanish, in the order shown. */
export const presetLabels =
  /** @type {Record<typeof presets[number], string>} */ ({
    today: "Hoy",
    "7d": "7 días",
    "30d": "30 días",
    month: "Este mes",
    year: "Este año",
    all: "Todo",
    custom: "Personalizado",
  });

const dayText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Query string of the dashboard: `?range=30d` or `?range=custom&from=...&to=...`. */
export const rangeQuerySchema = z.object({
  range: z.enum(presets).default("30d"),
  from: dayText.optional(),
  to: dayText.optional(),
});

/**
 * @typedef {object} DayRange
 * @property {typeof presets[number]} preset - Which preset was used.
 * @property {string} from - First day, `YYYY-MM-DD`, included.
 * @property {string} to - Last day, `YYYY-MM-DD`, included.
 * @property {{ from: string, to: string }} previous - The period just before, with the same length.
 */

/**
 * Number of days between two day keys.
 * @param {string} from - First day.
 * @param {string} to - Last day.
 * @returns {number} Days, counting both ends.
 */
export function daysBetween(from, to) {
  const ms = Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`);
  return Math.round(ms / 86400000) + 1;
}

/**
 * Works out a range.
 * @param {unknown} query - The query string as an object, for example from `Object.fromEntries(url.searchParams)`.
 * @param {Date} now - The current time.
 * @returns {DayRange} The range. A wrong query falls back to the last 30 days.
 */
export function resolveRange(query, now) {
  const parsed = rangeQuerySchema.safeParse(query);
  const { range, from, to } = parsed.success
    ? parsed.data
    : { range: /** @type {const} */ ("30d"), from: undefined, to: undefined };
  const today = dayKey(now);
  /** @type {string} */
  let start = addDays(today, -29);
  /** @type {string} */
  let end = today;

  if (range === "today") start = today;
  else if (range === "7d") start = addDays(today, -6);
  else if (range === "month") start = `${today.slice(0, 7)}-01`;
  else if (range === "year") start = `${today.slice(0, 4)}-01-01`;
  else if (range === "all") start = analyticsLaunchDay;
  else if (range === "custom" && from && to) {
    start = from <= to ? from : to;
    end = from <= to ? to : from;
    if (end > today) end = today;
    if (start > end) start = end;
  }
  if (start < analyticsLaunchDay && range !== "custom")
    start = analyticsLaunchDay;

  const length = daysBetween(start, end);
  return {
    preset: range,
    from: start,
    to: end,
    previous: { from: addDays(start, -length), to: addDays(start, -1) },
  };
}

/**
 * Change of a number against the previous period.
 * @param {number} current - Value now.
 * @param {number} previous - Value in the previous period.
 * @returns {{ percent: number | null, direction: "up" | "down" | "same" | "new" }} The change; `new` when the previous value was zero.
 */
export function compareValues(current, previous) {
  if (previous === 0) {
    return { percent: null, direction: current === 0 ? "same" : "new" };
  }
  const percent = Math.round(((current - previous) / previous) * 100);
  return {
    percent,
    direction: percent > 0 ? "up" : percent < 0 ? "down" : "same",
  };
}
