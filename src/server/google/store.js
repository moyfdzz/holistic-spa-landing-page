/**
 * Reads and writes the Search Console tables.
 * @module server/google/store
 */
import { sql } from "drizzle-orm";

/**
 * A Drizzle Postgres database (Neon in production, PGlite in tests).
 * @typedef {import("drizzle-orm/pg-core").PgDatabase<import("drizzle-orm/pg-core").PgQueryResultHKT, Record<string, unknown>>} Db
 */

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
 * The first and the last day that were imported.
 * @param {Db} db - The database.
 * @returns {Promise<{ earliest: string | null, latest: string | null }>} Both are null before the first import.
 */
export async function importedRange(db) {
  const result = await db.execute(sql`
    select min(day)::text as earliest, max(day)::text as latest from search_console_totals
  `);
  const row = rowsOf(result)[0];
  return {
    earliest: row?.earliest ? String(row.earliest) : null,
    latest: row?.latest ? String(row.latest) : null,
  };
}

/**
 * Replaces everything of one day, details and totals, in a single statement: running it twice
 * gives the same result, rows that Google no longer gives are removed, and a failure leaves
 * the day as it was.
 * @param {Db} db - The database.
 * @param {string} day - The day as `YYYY-MM-DD`.
 * @param {import("./search-console.js").MetricsRow} totals - The totals of the day.
 * @param {import("./search-console.js").DetailRow[]} details - The rows of the day.
 * @returns {Promise<{ details: number, removed: number }>} How many rows were written and how many removed.
 */
export async function replaceSearchConsoleDay(db, day, totals, details) {
  const totalsPayload = JSON.stringify([{ day, ...totals }]);
  const detailsPayload = JSON.stringify(details);
  const result = await db.execute(sql`
    with new_details as (
      select * from jsonb_to_recordset(${detailsPayload}::jsonb) as t(
        day date, query text, page text, country text, device text,
        clicks int, impressions int, ctr float8, position float8
      )
    ),
    new_totals as (
      select * from jsonb_to_recordset(${totalsPayload}::jsonb) as t(
        day date, clicks int, impressions int, ctr float8, position float8
      )
    ),
    written_details as (
      insert into search_console_daily
        (day, query, page, country, device, clicks, impressions, ctr, position)
      select day, query, page, country, device, clicks, impressions, ctr, position
      from new_details
      on conflict (day, query, page, country, device) do update set
        clicks = excluded.clicks,
        impressions = excluded.impressions,
        ctr = excluded.ctr,
        position = excluded.position
      returning 1
    ),
    written_totals as (
      insert into search_console_totals (day, clicks, impressions, ctr, position)
      select day, clicks, impressions, ctr, position from new_totals
      on conflict (day) do update set
        clicks = excluded.clicks,
        impressions = excluded.impressions,
        ctr = excluded.ctr,
        position = excluded.position
      returning 1
    ),
    removed_details as (
      delete from search_console_daily d
      where d.day = ${day}::date
        and not exists (
          select 1 from new_details n
          where n.query = d.query and n.page = d.page
            and n.country = d.country and n.device = d.device
        )
      returning 1
    )
    select
      (select count(*) from written_details)::int as details,
      (select count(*) from written_totals)::int as totals,
      (select count(*) from removed_details)::int as removed
  `);
  const row = rowsOf(result)[0];
  return {
    details: Number(row?.details ?? 0),
    removed: Number(row?.removed ?? 0),
  };
}
