/**
 * POST /api/collect: receives the events of the anonymous, cookieless tracker.
 * It answers 204 for everything it accepts or deliberately ignores (bots, Do Not Track, other
 * origins), so the tracker never learns why, and 400 for a malformed request.
 */
import { env } from "cloudflare:workers";
import { site } from "../../config/site.js";
import { buildEventRow } from "../../server/analytics/collect.js";
import { getDailySalt, insertEvent } from "../../server/analytics/store.js";
import { dayKey } from "../../server/analytics/visitor.js";
import { createDb } from "../../server/db/client.js";
import { parseServerEnv } from "../../server/env.js";

export const prerender = false;

const maxBodyBytes = 2048;

/**
 * @param {{ request: Request }} context - The Astro context.
 * @returns {Promise<Response>} 204, 400, 413 or 500.
 */
export async function POST({ request }) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBodyBytes) return new Response(null, { status: 413 });
  const text = await request.text();
  if (text.length > maxBodyBytes) return new Response(null, { status: 413 });

  /** @type {unknown} */
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response(null, { status: 400 });
  }

  try {
    // The database is only opened for events that will be stored.
    /** @type {ReturnType<typeof createDb> | undefined} */
    let db;
    const getDb = () => (db ??= createDb(parseServerEnv(env).DATABASE_URL));
    const now = new Date();
    const result = await buildEventRow({
      body,
      headers: request.headers,
      cf: /** @type {Request & { cf?: { country?: string, region?: string, city?: string } }} */ (
        request
      ).cf,
      siteHost: new URL(site.url).hostname,
      getSalt: () => getDailySalt(getDb(), dayKey(now)),
      now,
    });
    if ("dropped" in result) {
      return new Response(null, {
        status: result.dropped === "invalid" ? 400 : 204,
      });
    }
    await insertEvent(getDb(), result.row);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 500 });
  }
}
