/**
 * The daily import of Search Console: which days to ask for, and the loop that asks and stores.
 * @module server/google/import
 */
import { addDays, dayKey } from "../analytics/visitor.js";
import { getAccessToken, SEARCH_CONSOLE_SCOPE } from "./auth.js";
import { importedRange, replaceSearchConsoleDay } from "./store.js";
import { fetchDayDetails, fetchDayTotals } from "./search-console.js";

/** First day with Search Console data: the property was verified on this day. */
export const SEARCH_CONSOLE_START_DAY = "2026-10-11";

/** Search Console data is final about two days late. */
export const LAG_DAYS = 2;

/** Days that are asked for again on every run, because the newest ones can still change. */
export const RECENT_DAYS = 3;

/**
 * Most days one run asks for. A Worker on the free plan may make 50 requests per run, and each
 * day costs three (the totals, the details and the database), next to the ones of the daily
 * job. Whatever does not fit waits for the next night.
 */
export const MAX_DAYS_PER_RUN = 9;

/**
 * Works out which days to ask for, the newest first.
 * @param {object} input - The facts.
 * @param {string} input.lastAvailable - The newest day Google has final data for.
 * @param {string | null} input.earliest - The oldest day already imported.
 * @param {string | null} input.latest - The newest day already imported.
 * @param {string} [input.startDay] - The first day that can have data.
 * @param {number} [input.limit] - The most days to return.
 * @returns {string[]} The days: the recent ones, then the ones missing since the last run, then
 * the history that is still to be filled in.
 */
export function planDays({
  lastAvailable,
  earliest,
  latest,
  startDay = SEARCH_CONSOLE_START_DAY,
  limit = MAX_DAYS_PER_RUN,
}) {
  /** @type {string[]} */
  const days = [];
  const down = (/** @type {string} */ from, /** @type {string} */ to) => {
    for (let day = from; day >= to; day = addDays(day, -1)) days.push(day);
  };
  const recentStart = addDays(lastAvailable, -(RECENT_DAYS - 1));
  down(lastAvailable, recentStart < startDay ? startDay : recentStart);
  const oldestRecent = days[days.length - 1];
  if (oldestRecent === undefined) return [];
  // Days between the last run and the recent ones, if a run was missed.
  if (latest !== null && addDays(latest, 1) < oldestRecent)
    down(addDays(oldestRecent, -1), addDays(latest, 1));
  // The history before everything that is already imported.
  const anchor =
    earliest !== null && earliest < oldestRecent ? earliest : oldestRecent;
  if (anchor > startDay) down(addDays(anchor, -1), startDay);
  return days.slice(0, limit);
}

/**
 * @typedef {object} ImportSummary
 * @property {boolean} skipped - Nothing was done.
 * @property {string} [reason] - Why, when it was skipped.
 * @property {number} days - How many days were imported.
 * @property {number} rows - How many detail rows were written.
 * @property {string | null} from - The oldest day imported in this run.
 * @property {string | null} to - The newest day imported in this run.
 */

/**
 * Imports Search Console. It logs nothing itself: the caller logs the summary, which has counts
 * only.
 * @param {object} input - What the import needs.
 * @param {import("./store.js").Db} input.db - The database.
 * @param {import("./config.js").SearchConsoleConfig} input.config - The Google settings.
 * @param {Date} input.now - The current time.
 * @param {typeof fetch} [input.fetchFn] - `fetch`, or a fake in tests.
 * @param {(milliseconds: number) => Promise<void>} [input.sleep] - Waits; a fake in tests.
 * @param {typeof getAccessToken} [input.tokenFn] - Gets the access token; a fake in tests.
 * @returns {Promise<ImportSummary>} What was done.
 */
export async function runSearchConsoleImport({
  db,
  config,
  now,
  fetchFn = fetch,
  sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  tokenFn = getAccessToken,
}) {
  /** @type {ImportSummary} */
  const nothing = { skipped: true, days: 0, rows: 0, from: null, to: null };
  if (!config.configured)
    return {
      ...nothing,
      reason: `not configured (missing ${config.missing.join(", ")})`,
    };
  const lastAvailable = addDays(dayKey(now), -LAG_DAYS);
  if (lastAvailable < SEARCH_CONSOLE_START_DAY)
    return { ...nothing, reason: "no data yet" };

  const { earliest, latest } = await importedRange(db);
  const days = planDays({ lastAvailable, earliest, latest });
  const token = await tokenFn(
    config.account,
    SEARCH_CONSOLE_SCOPE,
    fetchFn,
    now,
  );
  const client = { fetchFn, token, siteUrl: config.siteUrl, sleep };

  let rows = 0;
  for (const day of days) {
    const totals = await fetchDayTotals(client, day);
    const details = await fetchDayDetails(client, day);
    const written = await replaceSearchConsoleDay(db, day, totals, details);
    rows += written.details;
  }
  return {
    skipped: false,
    days: days.length,
    rows,
    from: days[days.length - 1] ?? null,
    to: days[0] ?? null,
  };
}
