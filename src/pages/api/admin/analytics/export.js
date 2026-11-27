/**
 * GET /api/admin/analytics/export?table=series|<dimension>&from&to&granularity=day|week|month|year
 * Downloads one table of the dashboard as CSV. The middleware has already checked that the
 * request is from the owner. A dimension is exported whole, not only its top rows.
 */
import { env } from "cloudflare:workers";
import { z } from "zod";
import { refuseUnguarded } from "../../../../server/admin/guard.js";
import { csvFilename, toCsv } from "../../../../server/analytics/csv.js";
import {
  exportTables,
  parseAnalyticsQuery,
  readTable,
} from "../../../../server/analytics/query.js";
import { createDb } from "../../../../server/db/client.js";
import { parseServerEnv } from "../../../../server/env.js";
import { describeError } from "../../../../server/errors.js";

export const prerender = false;

const tableSchema = z.enum(exportTables);

/**
 * @param {string} error - What was wrong, without details.
 * @param {number} status - HTTP status.
 * @returns {Response} A JSON error.
 */
function fail(error, status) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * @param {{ url: URL, locals: App.Locals }} context - The Astro context.
 * @returns {Promise<Response>} The CSV, 400 for a wrong query or 500 when the database fails.
 */
export async function GET({ url, locals }) {
  const refusal = refuseUnguarded(locals);
  if (refusal) return refusal;
  const now = new Date();
  const params = Object.fromEntries(url.searchParams);
  const table = tableSchema.safeParse(params.table);
  if (!table.success) return fail("Invalid table", 400);
  const parsed = parseAnalyticsQuery(params, now);
  if (!parsed.ok) return fail(parsed.error, 400);
  try {
    const db = createDb(parseServerEnv(env).DATABASE_URL);
    const rows = await readTable(db, parsed.query, table.data, now);
    return new Response(toCsv(table.data, rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${csvFilename(table.data, parsed.query)}"`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("analytics export failed:", describeError(error));
    return fail("Could not read the numbers", 500);
  }
}
