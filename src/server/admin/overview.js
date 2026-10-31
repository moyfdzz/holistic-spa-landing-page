/**
 * What the Resumen page shows, worked out from the query API's answer. Pure functions.
 * @module server/admin/overview
 */
import {
  analyticsLaunchDay,
  daysBetween,
  resolveRange,
} from "../analytics/range.js";
import { bucketStarts, fillVisitors } from "./chart.js";
import {
  formatCount,
  formatDay,
  formatDecimal,
  formatDuration,
  formatPercent,
} from "./format.js";

/** @typedef {import("./chart.js").Granularity} Granularity */

/** The ways the series can be grouped, with their labels, in the order shown. */
export const granularityOptions = /** @type {const} */ ([
  ["day", "Por día"],
  ["week", "Por semana"],
  ["month", "Por mes"],
  ["year", "Por año"],
]);

/**
 * Picks how to group a range so the chart has a readable number of points.
 * @param {string} from - First day of the range.
 * @param {string} to - Last day of the range.
 * @returns {Granularity} Days up to two months, weeks up to nine, months up to three years.
 */
export function autoGranularity(from, to) {
  const days = daysBetween(from, to);
  if (days <= 62) return "day";
  if (days <= 270) return "week";
  if (days <= 1100) return "month";
  return "year";
}

/**
 * Reads the address of the page.
 * @param {Record<string, string>} query - The query string as an object.
 * @param {Date} now - The current time.
 * @returns {{ range: import("../analytics/range.js").DayRange, granularity: Granularity, compare: boolean }} The range, how to group it
 * (`g` in the address, or automatic) and whether the previous period can be compared (it
 * cannot when it ends before the tracker existed).
 */
export function readOverviewRequest(query, now) {
  const range = resolveRange(query, now);
  const asked = granularityOptions.find(([value]) => value === query.g);
  return {
    range,
    granularity: asked ? asked[0] : autoGranularity(range.from, range.to),
    compare: range.previous.to >= analyticsLaunchDay,
  };
}

/**
 * @typedef {object} Tile
 * @property {string} id - Stable name, for tests.
 * @property {string} label - What the number is.
 * @property {number} value - The number, to compare.
 * @property {string} display - The number as it is written.
 * @property {number} [previous] - The number of the previous period.
 * @property {string} [note] - A short note under the number.
 */

/**
 * @typedef {object} Overview
 * @property {boolean} empty - There are no events in the range.
 * @property {string | null} through - Last day with totals.
 * @property {Tile[]} tiles - The headline numbers.
 * @property {{ buckets: string[], values: number[], previousBuckets: string[] | null, previousValues: number[] | null, previousTotal: number | null, granularity: Granularity }} visits - The visits series, with a zero on days without data.
 */

/**
 * Days of a period that can have data: the tracker did not exist before its first day.
 * @param {string} from - First day of the period.
 * @param {string} to - Last day of the period.
 * @returns {number} At least 1.
 */
function daysWithTracker(from, to) {
  const start = from < analyticsLaunchDay ? analyticsLaunchDay : from;
  return start > to ? 1 : daysBetween(start, to);
}

/**
 * Average visitors per day, to one decimal.
 * @param {number} visitors - The sum of the daily visitors.
 * @param {number} days - Days of the period.
 * @returns {number} The average.
 */
const perDay = (visitors, days) => Math.round((visitors / days) * 10) / 10;

/**
 * Turns the answer of the query API into what the page shows.
 * @param {import("../analytics/query.js").AnalyticsResult} result - The answer of the query API.
 * @returns {Overview} The tiles and the series.
 */
export function buildOverview(result) {
  const { totals, contacts, distributions, comparison, range } = result;
  const rate = (
    /** @type {number} */ contacted,
    /** @type {number} */ visitors,
  ) => (visitors > 0 ? contacted / visitors : 0);
  const conversion = rate(contacts.visitors, totals.visitors);
  const median = distributions.engaged_seconds?.p50 ?? null;

  // A visitor id lasts one day, so a range of several days holds the sum of the daily visitors.
  const oneDay = range.from === range.to;
  const days = daysWithTracker(range.from, range.to);
  const average = perDay(totals.visitors, days);
  // The busiest day can only be named when the series has one point per day.
  const busiest =
    range.granularity === "day"
      ? result.series.reduce(
          (best, point) =>
            point.visitors > (best?.visitors ?? 0) ? point : best,
          /** @type {import("../analytics/query.js").SeriesPoint | null} */ (
            null
          ),
        )
      : null;

  /** @type {Tile[]} */
  const tiles = [
    oneDay
      ? {
          id: "visitors",
          label: "Visitantes",
          value: totals.visitors,
          display: formatCount(totals.visitors),
          previous: comparison?.totals.visitors,
          note: "Personas distintas del día",
        }
      : {
          id: "visitors",
          label: "Visitantes (suma de días)",
          value: totals.visitors,
          display: formatCount(totals.visitors),
          previous: comparison?.totals.visitors,
          note: "Quien vuelve otro día cuenta otra vez",
        },
    ...(oneDay
      ? []
      : [
          {
            id: "visitorsPerDay",
            label: "Visitantes por día",
            value: average,
            display: formatDecimal(average),
            previous: comparison
              ? perDay(
                  comparison.totals.visitors,
                  daysWithTracker(comparison.from, comparison.to),
                )
              : undefined,
            note: busiest
              ? `Promedio de ${formatCount(days)} días. Más visitantes: ${formatDay(busiest.bucket)} (${formatCount(busiest.visitors)})`
              : `Promedio de ${formatCount(days)} días`,
          },
        ]),
    {
      id: "sessions",
      label: "Sesiones",
      value: totals.sessions,
      display: formatCount(totals.sessions),
      previous: comparison?.totals.sessions,
    },
    {
      id: "engaged",
      label: "Tiempo activo",
      value: totals.avgEngagedSeconds,
      display: formatDuration(totals.avgEngagedSeconds),
      previous: comparison?.totals.avgEngagedSeconds,
      note:
        median === null
          ? "Promedio por sesión"
          : `Promedio por sesión. Mediana: ${formatDuration(median)}`,
    },
    {
      id: "messages",
      label: "Mensajes del formulario",
      value: contacts.messages,
      display: formatCount(contacts.messages),
      previous: comparison?.contacts.messages,
    },
    {
      id: "whatsapp",
      label: "Clics en WhatsApp",
      value: contacts.whatsapp,
      display: formatCount(contacts.whatsapp),
      previous: comparison?.contacts.whatsapp,
    },
    {
      id: "conversion",
      label: "Conversión",
      value: Math.round(conversion * 1000) / 10,
      display: formatPercent(conversion),
      previous: comparison
        ? Math.round(
            rate(comparison.contacts.visitors, comparison.totals.visitors) *
              1000,
          ) / 10
        : undefined,
      note: "Visitantes que escribieron, llamaron o pulsaron WhatsApp",
    },
  ];

  const buckets = bucketStarts(range.from, range.to, range.granularity);
  const previousBuckets = comparison
    ? bucketStarts(comparison.from, comparison.to, range.granularity)
    : null;
  return {
    empty: totals.events === 0,
    through: result.through,
    tiles,
    visits: {
      buckets,
      values: fillVisitors(result.series, buckets),
      previousBuckets,
      previousValues:
        comparison && previousBuckets
          ? fillVisitors(comparison.series, previousBuckets)
          : null,
      previousTotal: comparison ? comparison.totals.visitors : null,
      granularity: range.granularity,
    },
  };
}
