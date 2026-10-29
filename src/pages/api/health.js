/**
 * GET /api/health: is the site up and does the database answer?
 * On-demand route; the public pages stay prerendered.
 */
import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { createDb } from "../../server/db/client.js";
import { parseServerEnv } from "../../server/env.js";
import { checkHealth } from "../../server/health.js";
import { version } from "../../../package.json";

export const prerender = false;

/**
 * @returns {Promise<Response>} JSON with the status of the site and the database.
 */
export async function GET() {
  const { status, body } = await checkHealth({
    version,
    ping: async () => {
      const db = createDb(parseServerEnv(env).DATABASE_URL);
      await db.execute(sql`select 1`);
    },
  });
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
