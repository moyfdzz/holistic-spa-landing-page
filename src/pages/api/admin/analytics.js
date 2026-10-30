/**
 * GET /api/admin/analytics?from&to&granularity=day|week|month|year&compare=previous
 * Numbers for the dashboard. The middleware has already checked that the request is from the
 * owner; the totals come from `analytics_daily` and `live` from the raw events of the last 30
 * minutes.
 */
import { env } from "cloudflare:workers";
import { createDb } from "../../../server/db/client.js";
import { parseServerEnv } from "../../../server/env.js";
import { describeError } from "../../../server/errors.js";
import {
  countLiveVisitors,
  parseAnalyticsQuery,
  queryAnalyticsCached,
} from "../../../server/analytics/query.js";

export const prerender = false;

/**
 * @param {unknown} body - What to answer.
 * @param {number} [status] - HTTP status.
 * @returns {Response} A JSON response.
 */
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * @param {{ url: URL }} context - The Astro context.
 * @returns {Promise<Response>} The numbers, 400 for a wrong query or 500 when the database fails.
 */
export async function GET({ url }) {
  const now = new Date();
  const parsed = parseAnalyticsQuery(Object.fromEntries(url.searchParams), now);
  if (!parsed.ok) return json({ error: parsed.error }, 400);
  try {
    const db = createDb(parseServerEnv(env).DATABASE_URL);
    const [data, live] = await Promise.all([
      queryAnalyticsCached(db, parsed.query, now),
      countLiveVisitors(db, now),
    ]);
    return json({ ...data, live });
  } catch (error) {
    console.error("analytics query failed:", describeError(error));
    return json({ error: "Could not read the numbers" }, 500);
  }
}
