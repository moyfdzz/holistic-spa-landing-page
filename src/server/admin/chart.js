/**
 * Geometry of the charts of the admin panel. The charts are drawn as plain SVG on the server, so
 * everything here is pure: numbers in, coordinates and text out.
 * @module server/admin/chart
 */
import { addDays } from "../analytics/visitor.js";
import { formatBucket, formatCount } from "./format.js";

/** @typedef {"day" | "week" | "month" | "year"} Granularity */

/**
 * Number of days between a Monday-based week start and a day.
 * @param {string} day - A day as `YYYY-MM-DD`.
 * @returns {number} 0 for Monday, 6 for Sunday.
 */
function daysSinceMonday(day) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return (weekday + 6) % 7;
}

/**
 * First day of the bucket a day falls in.
 * @param {string} day - A day as `YYYY-MM-DD`.
 * @param {Granularity} granularity - How the series is grouped.
 * @returns {string} The first day of that day, week (Monday), month or year.
 */
export function bucketOf(day, granularity) {
  if (granularity === "day") return day;
  if (granularity === "week") return addDays(day, -daysSinceMonday(day));
  if (granularity === "month") return `${day.slice(0, 7)}-01`;
  return `${day.slice(0, 4)}-01-01`;
}

/**
 * First day of the bucket after another one.
 * @param {string} bucket - The first day of a bucket.
 * @param {Granularity} granularity - How the series is grouped.
 * @returns {string} The first day of the next bucket.
 */
function nextBucket(bucket, granularity) {
  if (granularity === "day") return addDays(bucket, 1);
  if (granularity === "week") return addDays(bucket, 7);
  const year = Number(bucket.slice(0, 4));
  const month = Number(bucket.slice(5, 7));
  if (granularity === "year") return `${year + 1}-01-01`;
  return month === 12
    ? `${year + 1}-01-01`
    : `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

/**
 * Lists every bucket of a range, also the ones without data, so the line has no gaps.
 * @param {string} from - First day of the range.
 * @param {string} to - Last day of the range.
 * @param {Granularity} granularity - How the series is grouped.
 * @returns {string[]} The first day of each bucket, in order.
 */
export function bucketStarts(from, to, granularity) {
  /** @type {string[]} */
  const starts = [];
  for (
    let bucket = bucketOf(from, granularity);
    bucket <= to;
    bucket = nextBucket(bucket, granularity)
  ) {
    starts.push(bucket);
  }
  return starts;
}

/**
 * Puts the values of a series on every bucket, with zero where the series has none.
 * @param {Array<{ bucket: string, visitors: number }>} points - The points of the series.
 * @param {string[]} starts - The buckets, from `bucketStarts`.
 * @returns {number[]} One value per bucket.
 */
export function fillVisitors(points, starts) {
  const byBucket = new Map(
    points.map((point) => [point.bucket, point.visitors]),
  );
  return starts.map((bucket) => byBucket.get(bucket) ?? 0);
}

/**
 * Rounds a maximum up to a tidy number for the top of an axis, and gives the ticks.
 * Steps are 1, 2 or 5 times a power of ten, so counts stay whole.
 * @param {number} max - The biggest value in the chart.
 * @param {number} [target] - About how many intervals the axis should have.
 * @returns {{ max: number, ticks: number[] }} The top of the axis and the ticks from 0 to it.
 */
export function niceTicks(max, target = 4) {
  if (!(max > 0)) return { max: 1, ticks: [0, 1] };
  const rough = max / target;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = Math.max(
    1,
    [1, 2, 5, 10].map((factor) => factor * power).find((s) => s >= rough) ??
      10 * power,
  );
  const intervals = Math.ceil(max / step);
  return {
    max: intervals * step,
    ticks: Array.from({ length: intervals + 1 }, (_, index) => index * step),
  };
}

/**
 * Picks which labels of the horizontal axis to show so they never touch.
 * @param {number} count - How many points the chart has.
 * @param {number} [most] - The most labels that fit.
 * @returns {number[]} The indexes to label, always including the first and the last.
 */
export function pickLabelIndexes(count, most = 4) {
  if (count <= 0) return [];
  if (count <= most) return Array.from({ length: count }, (_, index) => index);
  const last = count - 1;
  return [
    ...new Set(
      Array.from({ length: most }, (_, index) =>
        Math.round((index * last) / (most - 1)),
      ),
    ),
  ];
}

/**
 * Rounds a coordinate to one decimal, to keep the drawing small.
 * @param {number} value - A coordinate.
 * @returns {number} The coordinate with one decimal.
 */
const round = (value) => Math.round(value * 10) / 10;

/**
 * @typedef {object} LineChart
 * @property {number} width - Width of the drawing, in drawing units.
 * @property {number} height - Height of the drawing.
 * @property {{ left: number, right: number, top: number, bottom: number }} plot - The area of the lines.
 * @property {{ value: number, y: number }[]} yTicks - Ticks of the vertical axis.
 * @property {{ index: number, x: number }[]} xLabels - Points that get a label on the horizontal axis.
 * @property {{ x: number, y: number, value: number }[]} points - The current series.
 * @property {{ x: number, y: number, value: number }[]} previousPoints - The previous series, as many points as it has up to the current ones.
 * @property {string} line - Path of the current line.
 * @property {string} area - Path of the area under the current line.
 * @property {string} previousLine - Path of the previous line, empty when there is none.
 * @property {number} max - The top of the vertical axis.
 */

/**
 * Computes the drawing of a line chart with an optional comparison line.
 * @param {object} input - The data and size.
 * @param {number[]} input.values - The current series, one value per bucket.
 * @param {number[] | null} [input.previous] - The previous period, lined up by position.
 * @param {number} [input.width] - Width of the drawing.
 * @param {number} [input.height] - Height of the drawing.
 * @returns {LineChart} The coordinates.
 */
export function buildLineChart({
  values,
  previous = null,
  width = 640,
  height = 260,
}) {
  const plot = { left: 44, right: width - 16, top: 16, bottom: height - 32 };
  const shown = previous ? previous.slice(0, values.length) : [];
  const { max, ticks } = niceTicks(Math.max(0, ...values, ...shown));
  const innerWidth = plot.right - plot.left;
  const innerHeight = plot.bottom - plot.top;
  const xAt = (/** @type {number} */ index) =>
    values.length === 1
      ? plot.left + innerWidth / 2
      : plot.left + (index * innerWidth) / (values.length - 1);
  const yAt = (/** @type {number} */ value) =>
    plot.top + innerHeight * (1 - value / max);
  const toPoints = (/** @type {number[]} */ list) =>
    list.map((value, index) => ({
      x: round(xAt(index)),
      y: round(yAt(value)),
      value,
    }));
  const pathOf = (/** @type {{ x: number, y: number }[]} */ list) =>
    list
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`)
      .join(" ");

  const points = toPoints(values);
  const previousPoints = toPoints(shown);
  const line = pathOf(points);
  const baseline = round(plot.bottom);
  const area =
    points.length > 1
      ? `${line} L${points[points.length - 1].x} ${baseline} L${points[0].x} ${baseline} Z`
      : "";
  return {
    width,
    height,
    plot,
    yTicks: ticks.map((value) => ({ value, y: round(yAt(value)) })),
    xLabels: pickLabelIndexes(values.length).map((index) => ({
      index,
      x: round(xAt(index)),
    })),
    points,
    previousPoints,
    line,
    area,
    previousLine: previousPoints.length > 1 ? pathOf(previousPoints) : "",
    max,
  };
}

/**
 * Describes a series in a sentence, for people who do not see the chart.
 * @param {object} input - The data.
 * @param {string} input.what - What is counted, for example `Visitantes`.
 * @param {string[]} input.buckets - The first day of each bucket.
 * @param {number[]} input.values - The value of each bucket.
 * @param {Granularity} input.granularity - How the series is grouped.
 * @param {number | null} [input.previousTotal] - The total of the previous period, when compared.
 * @returns {string} A short summary.
 */
export function describeSeries({
  what,
  buckets,
  values,
  granularity,
  previousTotal = null,
}) {
  if (values.length === 0) return `${what}: sin datos en este periodo.`;
  const total = values.reduce((sum, value) => sum + value, 0);
  const unit = { day: "día", week: "semana", month: "mes", year: "año" }[
    granularity
  ];
  const peak = values.indexOf(Math.max(...values));
  const parts = [
    `${what} por ${unit}: ${formatCount(total)} en total.`,
    total > 0
      ? `El punto más alto fue ${formatBucket(buckets[peak], granularity)} con ${formatCount(values[peak])}.`
      : "Nadie visitó el sitio en este periodo.",
  ];
  if (previousTotal !== null)
    parts.push(`En el periodo anterior fueron ${formatCount(previousTotal)}.`);
  return parts.join(" ");
}
