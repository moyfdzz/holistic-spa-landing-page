/**
 * Reads the daily totals for the admin dashboard: totals, a series by day, week, month or year,
 * breakdowns by dimension and the comparison with the previous period.
 * @module server/analytics/query
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { analyticsLaunchDay, compareValues, daysBetween } from "./range.js";
import { addDays, dayKey } from "./visitor.js";

/**
 * A Drizzle Postgres database (Neon in production, PGlite in tests).
 * @typedef {import("drizzle-orm/pg-core").PgDatabase<import("drizzle-orm/pg-core").PgQueryResultHKT, Record<string, unknown>>} Db
 */

/** How the series is grouped. Weeks start on Monday. */
export const granularities = /** @type {const} */ ([
  "day",
  "week",
  "month",
  "year",
]);

/** Longest range a request may ask for, in days. */
export const MAX_RANGE_DAYS = 1830;

/** Rows kept per breakdown. */
export const BREAKDOWN_LIMIT = 20;

/** Minutes a visitor counts as "live" after their last event. */
export const LIVE_WINDOW_MINUTES = 30;

/** Dimensions of `analytics_daily` that the API returns as breakdowns. */
export const breakdownDimensions = /** @type {const} */ ([
  "path",
  "channel",
  "referrer_host",
  "country",
  "region",
  "city",
  "device",
  "browser",
  "os",
  "locale",
  "section",
  "service",
  "faq",
  "whatsapp",
  "event",
]);

const dayText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Query string of `GET /api/admin/analytics`. */
export const analyticsQuerySchema = z
  .object({
    from: dayText,
    to: dayText,
    granularity: z.enum(granularities).default("day"),
    compare: z.enum(["previous"]).optional(),
  })
  .refine((value) => !Number.isNaN(Date.parse(`${value.from}T12:00:00Z`)), {
    message: "from is not a date",
    path: ["from"],
  })
  .refine((value) => !Number.isNaN(Date.parse(`${value.to}T12:00:00Z`)), {
    message: "to is not a date",
    path: ["to"],
  });

/**
 * @typedef {object} AnalyticsQuery
 * @property {string} from - First day, `YYYY-MM-DD`, included.
 * @property {string} to - Last day, `YYYY-MM-DD`, included.
 * @property {typeof granularities[number]} granularity - How the series is grouped.
 * @property {boolean} compare - Whether to compare with the previous period.
 */

/**
 * Validates the query string and puts the range in order: `from` and `to` are swapped when
 * reversed, `to` is cut at today and `from` at the launch day.
 * @param {unknown} query - The query string as an object.
 * @param {Date} now - The current time.
 * @returns {{ ok: true, query: AnalyticsQuery } | { ok: false, error: string }} The query, or a short error.
 */
export function parseAnalyticsQuery(query, now) {
  const parsed = analyticsQuerySchema.safeParse(query);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: `Invalid ${issue.path.join(".") || "query"}: ${issue.message}`,
    };
  }
  const { from, to, granularity, compare } = parsed.data;
  const today = dayKey(now);
  let start = from <= to ? from : to;
  let end = from <= to ? to : from;
  if (end > today) end = today;
  if (start < analyticsLaunchDay) start = analyticsLaunchDay;
  if (start > end) start = end;
  if (daysBetween(start, end) > MAX_RANGE_DAYS) {
    return {
      ok: false,
      error: `The range is longer than ${MAX_RANGE_DAYS} days`,
    };
  }
  return {
    ok: true,
    query: {
      from: start,
      to: end,
      granularity,
      compare: compare === "previous",
    },
  };
}

/**
 * Gets the rows out of a query result, whatever the database driver.
 * @param {unknown} result - What `db.execute` returned.
 * @returns {Record<string, unknown>[]} The rows.
 */
function rowsOf(result) {
  const rows = /** @type {{ rows?: unknown }} */ (result).rows ?? result;
  return Array.isArray(rows) ? rows : [];
}

/**
 * @typedef {object} Metrics
 * @property {number} visitors - Sum of the daily visitors (the same person on two days counts twice).
 * @property {number} sessions - Sessions.
 * @property {number} pageViews - Page views.
 * @property {number} events - Events.
 * @property {number} engagedSeconds - Seconds with the page visible.
 * @property {number} bounces - Sessions with one page view and almost no engaged time.
 * @property {number} bounceRate - Bounces over sessions, 0 to 1.
 * @property {number} avgEngagedSeconds - Engaged seconds per session.
 */

/**
 * @typedef {Metrics & { bucket: string }} SeriesPoint One point of the series; `bucket` is its first day.
 */

/**
 * @typedef {Metrics & { key: string }} BreakdownEntry One value of a dimension, for example `instagram`.
 */

/**
 * @typedef {object} Comparison
 * @property {string} from - First day of the previous period.
 * @property {string} to - Last day of the previous period.
 * @property {Metrics} totals - Totals of the previous period.
 * @property {Record<"visitors" | "sessions" | "pageViews" | "events" | "avgEngagedSeconds", ReturnType<typeof compareValues>>} changes - Change of each number.
 */

/**
 * @typedef {object} AnalyticsResult
 * @property {{ from: string, to: string, granularity: typeof granularities[number] }} range - What was asked, after being put in order.
 * @property {string | null} through - Last day with totals; today and the days the job has not reached are not in them.
 * @property {Metrics} totals - Totals of the range.
 * @property {SeriesPoint[]} series - One point per bucket with data.
 * @property {Record<string, BreakdownEntry[]>} breakdowns - The top rows of each dimension.
 * @property {Comparison | null} comparison - The previous period, when asked for.
 */

/**
 * Turns summed columns into the metrics of the API.
 * @param {Record<string, unknown> | undefined} row - A row with the summed columns.
 * @returns {Metrics} The metrics, zeros when there is no row.
 */
function toMetrics(row) {
  const visitors = Number(row?.visitors ?? 0);
  const sessions = Number(row?.sessions ?? 0);
  const pageViews = Number(row?.page_views ?? 0);
  const events = Number(row?.events ?? 0);
  const engagedSeconds = Number(row?.engaged_seconds ?? 0);
  const bounces = Number(row?.bounces ?? 0);
  return {
    visitors,
    sessions,
    pageViews,
    events,
    engagedSeconds,
    bounces,
    bounceRate:
      sessions > 0 ? Math.round((bounces / sessions) * 1000) / 1000 : 0,
    avgEngagedSeconds: sessions > 0 ? Math.round(engagedSeconds / sessions) : 0,
  };
}

const sums = sql`
  coalesce(sum(visitors), 0)::int as visitors,
  coalesce(sum(sessions), 0)::int as sessions,
  coalesce(sum(page_views), 0)::int as page_views,
  coalesce(sum(events), 0)::int as events,
  coalesce(sum(engaged_seconds), 0)::int as engaged_seconds,
  coalesce(sum(bounces), 0)::int as bounces
`;

/**
 * Totals of a range, from the `total` rows.
 * @param {Db} db - The database.
 * @param {string} from - First day.
 * @param {string} to - Last day.
 * @returns {Promise<Metrics>} The totals.
 */
async function totalsOf(db, from, to) {
  const result = await db.execute(sql`
    select ${sums} from analytics_daily
    where dimension = 'total' and day >= ${from}::date and day <= ${to}::date
  `);
  return toMetrics(rowsOf(result)[0]);
}

/**
 * Compares each count of two periods.
 * @param {Metrics} current - Metrics now.
 * @param {Metrics} previous - Metrics of the previous period.
 * @returns {Record<"visitors" | "sessions" | "pageViews" | "events" | "avgEngagedSeconds", ReturnType<typeof compareValues>>} The changes.
 */
function changesOf(current, previous) {
  return {
    visitors: compareValues(current.visitors, previous.visitors),
    sessions: compareValues(current.sessions, previous.sessions),
    pageViews: compareValues(current.pageViews, previous.pageViews),
    events: compareValues(current.events, previous.events),
    avgEngagedSeconds: compareValues(
      current.avgEngagedSeconds,
      previous.avgEngagedSeconds,
    ),
  };
}

/**
 * Counts the visitors with an event in the last 30 minutes. It reads the raw events, so it is
 * the only number that includes today.
 * @param {Db} db - The database.
 * @param {Date} now - The current time.
 * @returns {Promise<number>} Distinct visitors.
 */
export async function countLiveVisitors(db, now) {
  const result = await db.execute(sql`
    select count(distinct visitor_id)::int as n from analytics_events
    where occurred_at >= ${now.toISOString()}::timestamptz - make_interval(mins => ${LIVE_WINDOW_MINUTES})
      and occurred_at <= ${now.toISOString()}::timestamptz
  `);
  return Number(rowsOf(result)[0]?.n ?? 0);
}

/**
 * Runs the query of the dashboard.
 * @param {Db} db - The database.
 * @param {AnalyticsQuery} query - A query from `parseAnalyticsQuery`.
 * @returns {Promise<AnalyticsResult>} Totals, series, breakdowns, the comparison and the last day with data.
 */
export async function queryAnalytics(db, query) {
  const { from, to, granularity, compare } = query;
  // `granularity` comes from a fixed list, so it is safe to use as the unit of `date_trunc`.
  const unit = sql.raw(`'${granularity}'`);

  const [totals, seriesResult, lastResult] = await Promise.all([
    totalsOf(db, from, to),
    db.execute(sql`
      select date_trunc(${unit}, day)::date::text as bucket, ${sums}
      from analytics_daily
      where dimension = 'total' and day >= ${from}::date and day <= ${to}::date
      group by 1 order by 1
    `),
    db.execute(sql`
      select max(day)::text as day from analytics_daily where dimension = 'total'
    `),
  ]);

  const breakdowns = Object.fromEntries(
    await Promise.all(
      breakdownDimensions.map(async (dimension) => {
        const result = await db.execute(sql`
          select key, ${sums} from analytics_daily
          where dimension = ${dimension} and day >= ${from}::date and day <= ${to}::date
          group by key
          order by sum(visitors) desc, sum(events) desc, key
          limit ${BREAKDOWN_LIMIT}
        `);
        return [
          dimension,
          rowsOf(result).map((row) => ({
            key: String(row.key),
            ...toMetrics(row),
          })),
        ];
      }),
    ),
  );

  const lastDay = rowsOf(lastResult)[0]?.day;
  const series = rowsOf(seriesResult).map((row) => ({
    bucket: String(row.bucket),
    ...toMetrics(row),
  }));

  /** @type {{ from: string, to: string, totals: Metrics, changes: ReturnType<typeof changesOf> } | null} */
  let comparison = null;
  if (compare) {
    const length = daysBetween(from, to);
    const previous = { from: addDays(from, -length), to: addDays(from, -1) };
    const previousTotals = await totalsOf(db, previous.from, previous.to);
    comparison = {
      ...previous,
      totals: previousTotals,
      changes: changesOf(totals, previousTotals),
    };
  }

  return {
    range: { from, to, granularity },
    through: lastDay ? String(lastDay) : null,
    totals,
    series,
    breakdowns,
    comparison,
  };
}

/** How long an answer is reused, in milliseconds. The data only changes once a day. */
export const CACHE_TTL_MS = 3 * 60 * 1000;

/** Most answers kept at once. */
const CACHE_MAX_ENTRIES = 50;

/** @type {Map<string, { at: number, value: unknown }>} */
const cache = new Map();

/**
 * Runs `queryAnalytics` and reuses the answer for a few minutes while this Worker instance
 * lives. A cache miss costs a few indexed reads, so losing it is harmless.
 * @param {Db} db - The database.
 * @param {AnalyticsQuery} query - The query.
 * @param {Date} now - The current time.
 * @returns {Promise<AnalyticsResult>} The same answer as `queryAnalytics`.
 */
export async function queryAnalyticsCached(db, query, now) {
  const key = JSON.stringify(query);
  const hit = cache.get(key);
  if (hit && now.getTime() - hit.at < CACHE_TTL_MS)
    return /** @type {AnalyticsResult} */ (hit.value);
  const value = await queryAnalytics(db, query);
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: now.getTime(), value });
  return value;
}

/** Empties the cache. Only the tests need it. */
export function clearAnalyticsCache() {
  cache.clear();
}
