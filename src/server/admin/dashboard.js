/**
 * Reads the numbers of the admin panel's pages from the database. The pages call this on the
 * server; the work of turning the answer into tiles and series is in `overview.js`.
 * @module server/admin/dashboard
 */
import {
  countLiveVisitors,
  parseAnalyticsQuery,
  queryAnalyticsCached,
} from "../analytics/query.js";
import { createDb } from "../db/client.js";
import { parseServerEnv } from "../env.js";
import { describeError } from "../errors.js";
import { buildOverview, readOverviewRequest } from "./overview.js";

/**
 * @typedef {object} OverviewLoad
 * @property {boolean} ok - The numbers were read.
 * @property {ReturnType<typeof readOverviewRequest>} request - The range and grouping asked for.
 * @property {number} live - Visitors in the last 30 minutes (0 when not read).
 * @property {import("./overview.js").Overview | null} overview - The tiles and series, or null when not read.
 */

/**
 * Loads what the Resumen page needs.
 * @param {Record<string, unknown>} env - The Worker's environment (it has `DATABASE_URL`).
 * @param {Record<string, string>} query - The query string of the page as an object.
 * @param {Date} now - The current time.
 * @returns {Promise<OverviewLoad>} The data, or `ok: false` with the request when it could not be read.
 */
export async function loadOverview(env, query, now) {
  const request = readOverviewRequest(query, now);
  const parsed = parseAnalyticsQuery(
    {
      from: request.range.from,
      to: request.range.to,
      granularity: request.granularity,
      compare: request.compare ? "previous" : undefined,
    },
    now,
  );
  if (!parsed.ok) return { ok: false, request, live: 0, overview: null };
  try {
    const db = createDb(parseServerEnv(env).DATABASE_URL);
    const [result, live] = await Promise.all([
      queryAnalyticsCached(db, parsed.query, now),
      countLiveVisitors(db, now),
    ]);
    return { ok: true, request, live, overview: buildOverview(result) };
  } catch (error) {
    console.error("overview failed:", describeError(error));
    return { ok: false, request, live: 0, overview: null };
  }
}
