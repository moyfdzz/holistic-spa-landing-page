/**
 * Reads the daily totals for the admin dashboard: totals, a series by day, week, month or year,
 * breakdowns by dimension and the comparison with the previous period.
 * @module server/analytics/query
 */
import { sql } from "drizzle-orm";
import { z } from "zod";
import { distributionBounds, mergeBuckets, summarize } from "./distribution.js";
import { rollupDay } from "./jobs.js";
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
  "contacted_channel",
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
 * @typedef {Record<string, { samples: number, p50: number | null, p75: number | null }>} Distributions
 * Median and p75 of each histogram metric over a range (`engaged_seconds`: seconds of active time
 * per session). A metric with no samples in the range is missing.
 */

/**
 * @typedef {object} Contacts
 * @property {number} visitors - Sum of the daily visitors who contacted the business (WhatsApp, phone, email or a sent form).
 * @property {number} messages - Contact forms that were sent.
 * @property {number} whatsapp - Clicks on any WhatsApp link.
 */

/**
 * @typedef {object} Comparison
 * @property {string} from - First day of the previous period.
 * @property {string} to - Last day of the previous period.
 * @property {Metrics} totals - Totals of the previous period.
 * @property {Contacts} contacts - Contacts of the previous period.
 * @property {SeriesPoint[]} series - The series of the previous period, with the same granularity.
 * @property {Distributions} distributions - Medians and percentiles of the previous period.
 * @property {Record<"visitors" | "sessions" | "pageViews" | "events" | "avgEngagedSeconds" | "medianEngagedSeconds", ReturnType<typeof compareValues>>} changes - Change of each number.
 */

/**
 * @typedef {object} AnalyticsResult
 * @property {{ from: string, to: string, granularity: typeof granularities[number] }} range - What was asked, after being put in order.
 * @property {string | null} through - Last day with totals; today and the days the job has not reached are not in them.
 * @property {Metrics} totals - Totals of the range.
 * @property {Contacts} contacts - How many contacted the business in the range.
 * @property {Distributions} distributions - Median and p75 of the active time per session (and of the speed measures).
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
 * @param {Distributions} currentDistributions - Medians now.
 * @param {Distributions} previousDistributions - Medians of the previous period.
 * @returns {Comparison["changes"]} The changes.
 */
function changesOf(
  current,
  previous,
  currentDistributions,
  previousDistributions,
) {
  return {
    medianEngagedSeconds: compareValues(
      currentDistributions.engaged_seconds?.p50 ?? 0,
      previousDistributions.engaged_seconds?.p50 ?? 0,
    ),
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
 * Counts the ways the business was contacted in a range.
 * @param {Db} db - The database.
 * @param {string} from - First day.
 * @param {string} to - Last day.
 * @returns {Promise<Contacts>} The counts.
 */
async function readContacts(db, from, to) {
  const result = await db.execute(sql`
    select
      coalesce(sum(case when dimension = 'conversion' and key = 'contacted' then visitors end), 0)::int as visitors,
      coalesce(sum(case when dimension = 'event' and key = 'form_success' then events end), 0)::int as messages,
      coalesce(sum(case when dimension = 'event' and key = 'whatsapp_click' then events end), 0)::int as whatsapp
    from analytics_daily
    where day >= ${from}::date and day <= ${to}::date
  `);
  const row = rowsOf(result)[0];
  return {
    visitors: Number(row?.visitors ?? 0),
    messages: Number(row?.messages ?? 0),
    whatsapp: Number(row?.whatsapp ?? 0),
  };
}

/**
 * Reads the histograms of a range, sums them and gives the median and p75 of each metric.
 * @param {Db} db - The database.
 * @param {string} from - First day.
 * @param {string} to - Last day.
 * @returns {Promise<Distributions>} The summary of each metric that has samples.
 */
async function readDistributions(db, from, to) {
  const result = await db.execute(sql`
    select metric, buckets from analytics_distributions
    where day >= ${from}::date and day <= ${to}::date
  `);
  /** @type {Map<string, number[][]>} */
  const byMetric = new Map();
  for (const row of rowsOf(result)) {
    const metric = String(row.metric);
    const buckets = Array.isArray(row.buckets) ? row.buckets.map(Number) : [];
    byMetric.set(metric, [...(byMetric.get(metric) ?? []), buckets]);
  }
  /** @type {Distributions} */
  const summary = {};
  for (const metric of Object.keys(distributionBounds)) {
    const list = byMetric.get(metric);
    if (!list) continue;
    const key = /** @type {keyof typeof distributionBounds} */ (metric);
    const one = summarize(key, mergeBuckets(key, list));
    if (one.samples > 0) summary[metric] = one;
  }
  return summary;
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
 * Reads the series of a range, one point per bucket with data.
 * @param {Db} db - The database.
 * @param {AnalyticsQuery} query - The query.
 * @returns {Promise<SeriesPoint[]>} The points in time order.
 */
async function readSeries(db, { from, to, granularity }) {
  // `granularity` comes from a fixed list, so it is safe to use as the unit of `date_trunc`.
  const unit = sql.raw(`'${granularity}'`);
  const result = await db.execute(sql`
    select date_trunc(${unit}, day)::date::text as bucket, ${sums}
    from analytics_daily
    where dimension = 'total' and day >= ${from}::date and day <= ${to}::date
    group by 1 order by 1
  `);
  return rowsOf(result).map((row) => ({
    bucket: String(row.bucket),
    ...toMetrics(row),
  }));
}

/**
 * Reads the values of one dimension over a range, the most visited first.
 * @param {Db} db - The database.
 * @param {string} from - First day.
 * @param {string} to - Last day.
 * @param {typeof breakdownDimensions[number]} dimension - The dimension.
 * @param {number} limit - Most rows to return.
 * @returns {Promise<BreakdownEntry[]>} The rows.
 */
async function readBreakdown(db, from, to, dimension, limit) {
  const result = await db.execute(sql`
    select key, ${sums} from analytics_daily
    where dimension = ${dimension} and day >= ${from}::date and day <= ${to}::date
    group by key
    order by sum(visitors) desc, sum(events) desc, key
    limit ${limit}
  `);
  return rowsOf(result).map((row) => ({
    key: String(row.key),
    ...toMetrics(row),
  }));
}

/**
 * Runs the query of the dashboard.
 * @param {Db} db - The database.
 * @param {AnalyticsQuery} query - A query from `parseAnalyticsQuery`.
 * @returns {Promise<AnalyticsResult>} Totals, series, breakdowns, the comparison and the last day with data.
 */
export async function queryAnalytics(db, query) {
  const { from, to, granularity, compare } = query;

  const [totals, contacts, distributions, series, lastResult] =
    await Promise.all([
      totalsOf(db, from, to),
      readContacts(db, from, to),
      readDistributions(db, from, to),
      readSeries(db, query),
      db.execute(sql`
      select max(day)::text as day from analytics_daily where dimension = 'total'
    `),
    ]);

  const breakdowns = Object.fromEntries(
    await Promise.all(
      breakdownDimensions.map(async (dimension) => [
        dimension,
        await readBreakdown(db, from, to, dimension, BREAKDOWN_LIMIT),
      ]),
    ),
  );

  const lastDay = rowsOf(lastResult)[0]?.day;

  /** @type {Comparison | null} */
  let comparison = null;
  if (compare) {
    const length = daysBetween(from, to);
    const previous = { from: addDays(from, -length), to: addDays(from, -1) };
    const [
      previousTotals,
      previousContacts,
      previousSeries,
      previousDistributions,
    ] = await Promise.all([
      totalsOf(db, previous.from, previous.to),
      readContacts(db, previous.from, previous.to),
      readSeries(db, { ...query, ...previous }),
      readDistributions(db, previous.from, previous.to),
    ]);
    comparison = {
      ...previous,
      totals: previousTotals,
      contacts: previousContacts,
      series: previousSeries,
      distributions: previousDistributions,
      changes: changesOf(
        totals,
        previousTotals,
        distributions,
        previousDistributions,
      ),
    };
  }

  return {
    range: { from, to, granularity },
    through: lastDay ? String(lastDay) : null,
    totals,
    contacts,
    distributions,
    series,
    breakdowns,
    comparison,
  };
}

/** How long an answer is reused, in milliseconds. Past days only change when the job runs. */
export const CACHE_TTL_MS = 3 * 60 * 1000;

/** How long an answer that includes today is reused. Today is recomputed at most this often. */
export const TODAY_TTL_MS = 60 * 1000;

/** When today was last recomputed in this Worker instance, in milliseconds. */
let lastTodayRefresh = 0;

/**
 * Recomputes today from the raw events, at most once a minute per Worker instance.
 * @param {Db} db - The database.
 * @param {Date} now - The current time.
 * @returns {Promise<void>}
 */
export async function refreshToday(db, now) {
  const age = now.getTime() - lastTodayRefresh;
  if (age >= 0 && age < TODAY_TTL_MS) return;
  await rollupDay(db, dayKey(now));
  lastTodayRefresh = now.getTime();
}

/** Most answers kept at once. */
const CACHE_MAX_ENTRIES = 50;

/** @type {Map<string, { at: number, value: unknown }>} */
const cache = new Map();

/**
 * Runs `queryAnalytics` and reuses the answer while this Worker instance lives: a few minutes,
 * or one minute when the range ends today. In that case a cache miss first recomputes today
 * from the raw events (`rollupDay`, which replaces the rows of the day in one statement), so
 * the numbers include today and the daily job later settles them. A miss costs a few indexed
 * reads, so losing the cache is harmless.
 * @param {Db} db - The database.
 * @param {AnalyticsQuery} query - The query.
 * @param {Date} now - The current time.
 * @returns {Promise<AnalyticsResult>} The same answer as `queryAnalytics`.
 */
export async function queryAnalyticsCached(db, query, now) {
  const key = JSON.stringify(query);
  const hit = cache.get(key);
  const today = dayKey(now);
  const endsToday = query.to === today;
  const ttl = endsToday ? TODAY_TTL_MS : CACHE_TTL_MS;
  if (hit && now.getTime() - hit.at < ttl)
    return /** @type {AnalyticsResult} */ (hit.value);
  if (endsToday) await refreshToday(db, now);
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
  lastTodayRefresh = 0;
}

/** Tables the dashboard can export: the series and each dimension. */
export const exportTables = /** @type {const} */ ([
  "series",
  ...breakdownDimensions,
]);

/** Most rows of a table in an export. */
export const MAX_EXPORT_ROWS = 10000;

/**
 * Reads a whole table of the dashboard for the CSV export: every row, not only the top ones.
 * When the range ends today it recomputes today first, like the dashboard does.
 * @param {Db} db - The database.
 * @param {AnalyticsQuery} query - A query from `parseAnalyticsQuery`.
 * @param {typeof exportTables[number]} table - `series` or a dimension.
 * @param {Date} now - The current time.
 * @returns {Promise<(SeriesPoint | BreakdownEntry)[]>} The rows, at most `MAX_EXPORT_ROWS`.
 */
export async function readTable(db, query, table, now) {
  if (query.to === dayKey(now)) await refreshToday(db, now);
  if (table === "series")
    return (await readSeries(db, query)).slice(0, MAX_EXPORT_ROWS);
  return readBreakdown(db, query.from, query.to, table, MAX_EXPORT_ROWS);
}
