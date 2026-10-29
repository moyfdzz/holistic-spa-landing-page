/**
 * Reads and writes analytics data.
 * @module server/analytics/store
 */
import { eq } from "drizzle-orm";
import { analyticsEvents, analyticsSalts } from "../db/schema.js";
import { newSalt } from "./visitor.js";

/**
 * A Drizzle Postgres database (Neon in production, PGlite in tests).
 * @typedef {import("drizzle-orm/pg-core").PgDatabase<import("drizzle-orm/pg-core").PgQueryResultHKT, Record<string, unknown>>} Db
 */

/**
 * Returns the salt of a day, creating it on first use. Safe when two requests arrive together.
 * @param {Db} db - The Drizzle database.
 * @param {string} day - The day as `YYYY-MM-DD`.
 * @returns {Promise<string>} The salt of that day.
 */
export async function getDailySalt(db, day) {
  await db
    .insert(analyticsSalts)
    .values({ day, salt: newSalt() })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(analyticsSalts)
    .where(eq(analyticsSalts.day, day));
  return row.salt;
}

/**
 * Stores one event.
 * @param {Db} db - The Drizzle database.
 * @param {import("./collect.js").EventRow} row - The row built by `buildEventRow`.
 * @returns {Promise<void>}
 */
export async function insertEvent(db, row) {
  await db.insert(analyticsEvents).values(row);
}
