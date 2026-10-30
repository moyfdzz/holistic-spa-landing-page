/**
 * The daily job: rolls up yesterday, removes what must not be kept, and reports counts only.
 * @module server/analytics/jobs
 */
import { and, gte, lt, sql } from "drizzle-orm";
import { analyticsEvents } from "../db/schema.js";
import { computeDailyRollup, computeDistributions } from "./rollup.js";
import { addDays, analyticsTimeZone, dayKey } from "./visitor.js";

/** Months raw events are kept. The privacy notice promises this period. */
export const RAW_EVENT_RETENTION_MONTHS = 13;

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
 * Recomputes the daily totals and the histograms of one day. Each is replaced in a single
 * statement, so running it twice gives the same result and a failure never leaves half of
 * either.
 * @param {import("drizzle-orm/pg-core").PgDatabase<import("drizzle-orm/pg-core").PgQueryResultHKT, Record<string, unknown>>} db - The database.
 * @param {string} day - The day as `YYYY-MM-DD` (Monterrey time).
 * @returns {Promise<number>} How many rows the day has.
 */
export async function rollupDay(db, day) {
  const start = sql`(${day}::date)::timestamp at time zone ${analyticsTimeZone}`;
  const end = sql`((${day}::date) + 1)::timestamp at time zone ${analyticsTimeZone}`;
  const events = await db
    .select()
    .from(analyticsEvents)
    .where(
      and(
        gte(analyticsEvents.occurredAt, start),
        lt(analyticsEvents.occurredAt, end),
      ),
    );
  const rolled = events.map((event) => ({
    ...event,
    occurredAt: new Date(event.occurredAt),
  }));
  const rows = computeDailyRollup(rolled, day);
  const distributions = computeDistributions(rolled, day);
  // Same names as the columns, so `jsonb_to_recordset` can read them.
  const payload = rows.map((entry) => ({
    day: entry.day,
    dimension: entry.dimension,
    key: entry.key,
    visitors: entry.visitors,
    sessions: entry.sessions,
    page_views: entry.pageViews,
    events: entry.events,
    engaged_seconds: entry.engagedSeconds,
    bounces: entry.bounces,
  }));
  // One statement: rows that are in the new result are inserted or updated, and rows of this
  // day that are no longer in it are deleted. The two parts touch different rows.
  await db.execute(sql`
    with new_rows as (
      select * from jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) as t(
        day date, dimension text, key text, visitors int, sessions int,
        page_views int, events int, engaged_seconds int, bounces int
      )
    ),
    upserted as (
      insert into analytics_daily
        (day, dimension, key, visitors, sessions, page_views, events, engaged_seconds, bounces)
      select day, dimension, key, visitors, sessions, page_views, events, engaged_seconds, bounces
      from new_rows
      on conflict (day, dimension, key) do update set
        visitors = excluded.visitors,
        sessions = excluded.sessions,
        page_views = excluded.page_views,
        events = excluded.events,
        engaged_seconds = excluded.engaged_seconds,
        bounces = excluded.bounces
      returning 1
    )
    delete from analytics_daily d
    where d.day = ${day}::date
      and not exists (
        select 1 from new_rows n where n.dimension = d.dimension and n.key = d.key
      )
  `);
  // Same idea for the histograms of the day (active time, speed). They are written after the
  // totals, so a failure in between leaves the totals new and the histograms of the last run
  // until the next run, which replaces them.
  await db.execute(sql`
    with new_rows as (
      select * from jsonb_to_recordset(${JSON.stringify(distributions)}::jsonb) as t(
        day date, metric text, samples int, buckets jsonb
      )
    ),
    upserted as (
      insert into analytics_distributions (day, metric, samples, buckets)
      select day, metric, samples, buckets from new_rows
      on conflict (day, metric) do update set
        samples = excluded.samples,
        buckets = excluded.buckets
      returning 1
    )
    delete from analytics_distributions d
    where d.day = ${day}::date
      and not exists (select 1 from new_rows n where n.metric = d.metric)
  `);
  return rows.length;
}

/**
 * Deletes the secret salts of the days before `today`, which makes the visitor ids of those
 * days impossible to recompute.
 * @param {import("drizzle-orm/pg-core").PgDatabase<import("drizzle-orm/pg-core").PgQueryResultHKT, Record<string, unknown>>} db - The database.
 * @param {string} today - Today as `YYYY-MM-DD` (Monterrey time).
 * @returns {Promise<number>} How many salts were deleted.
 */
export async function purgeOldSalts(db, today) {
  const result = await db.execute(sql`
    with removed as (delete from analytics_salts where day < ${today}::date returning 1)
    select count(*)::int as n from removed
  `);
  return Number(rowsOf(result)[0]?.n ?? 0);
}

/**
 * Deletes raw events older than the retention period.
 * @param {import("drizzle-orm/pg-core").PgDatabase<import("drizzle-orm/pg-core").PgQueryResultHKT, Record<string, unknown>>} db - The database.
 * @param {Date} now - The current time.
 * @returns {Promise<number>} How many events were deleted.
 */
export async function purgeOldEvents(db, now) {
  const result = await db.execute(sql`
    with removed as (
      delete from analytics_events
      where occurred_at < ${now.toISOString()}::timestamptz - make_interval(months => ${RAW_EVENT_RETENTION_MONTHS})
      returning 1
    )
    select count(*)::int as n from removed
  `);
  return Number(rowsOf(result)[0]?.n ?? 0);
}

/**
 * Runs the whole daily job. It rolls up yesterday and the day before (in case something arrived
 * late or an earlier run failed) and only then deletes old data.
 * @param {import("drizzle-orm/pg-core").PgDatabase<import("drizzle-orm/pg-core").PgQueryResultHKT, Record<string, unknown>>} db - The database.
 * @param {Date} now - The current time.
 * @returns {Promise<{ days: Record<string, number>, saltsDeleted: number, eventsDeleted: number }>} Counts only, safe to log.
 */
export async function runDailyJob(db, now) {
  const today = dayKey(now);
  /** @type {Record<string, number>} */
  const days = {};
  for (const day of [addDays(today, -2), addDays(today, -1)]) {
    days[day] = await rollupDay(db, day);
  }
  const saltsDeleted = await purgeOldSalts(db, today);
  const eventsDeleted = await purgeOldEvents(db, now);
  return { days, saltsDeleted, eventsDeleted };
}
