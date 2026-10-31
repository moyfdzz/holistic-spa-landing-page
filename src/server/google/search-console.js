/**
 * Reads one day of Search Console data. The API is asked for one day at a time, so the answer
 * of a day is small and a day can be replaced as a whole.
 * @module server/google/search-console
 */
import { z } from "zod";

/** Where the Search Analytics query lives (documented by Google). */
export const API_BASE = "https://www.googleapis.com/webmasters/v3/sites";

/** The most rows the API gives in one answer; more rows come with `startRow`. */
export const ROW_LIMIT = 25000;

/** Tries for each request: the first one and the ones after a failure that can pass. */
export const MAX_ATTEMPTS = 4;

/** Longest a query and a page can be in the primary key, so a huge one cannot break an index. */
export const QUERY_MAX = 500;
export const PAGE_MAX = 1000;

const answerSchema = z.object({
  rows: z
    .array(
      z.object({
        keys: z.array(z.string()),
        clicks: z.number(),
        impressions: z.number(),
        ctr: z.number(),
        position: z.number(),
      }),
    )
    .optional(),
});

/**
 * @typedef {object} SearchConsoleClient
 * @property {typeof fetch} fetchFn - `fetch`, or a fake in tests.
 * @property {string} token - The access token.
 * @property {string} siteUrl - The property, like `sc-domain:masajesrelaxmty.com` or `https://www.masajesrelaxmty.com/`.
 * @property {(milliseconds: number) => Promise<void>} sleep - Waits; a fake in tests.
 */

/**
 * @typedef {object} MetricsRow
 * @property {number} clicks - Clicks.
 * @property {number} impressions - Times the site was shown.
 * @property {number} ctr - Clicks over impressions, from 0 to 1.
 * @property {number} position - Average position in the results.
 */

/**
 * @typedef {MetricsRow & { day: string, query: string, page: string, country: string, device: string }} DetailRow
 */

/**
 * Waits as long as a failed request asks, or a growing time when it does not say.
 * @param {Response} response - The failed answer.
 * @param {number} attempt - Which try failed, from 1.
 * @returns {number} Milliseconds to wait, at most ten seconds.
 */
function waitAfter(response, attempt) {
  const asked = Number(response.headers.get("retry-after"));
  const seconds =
    Number.isFinite(asked) && asked > 0 ? asked : 0.5 * 2 ** (attempt - 1);
  return Math.min(seconds, 10) * 1000;
}

/**
 * Asks the Search Analytics API, trying again when the failure can pass (too many requests or a
 * server problem).
 * @param {SearchConsoleClient} client - The connection.
 * @param {Record<string, unknown>} body - The query.
 * @returns {Promise<z.infer<typeof answerSchema>["rows"]>} The rows of the answer, empty when there are none.
 * @throws {Error} With the status and Google's status word, never the token or the body.
 */
export async function querySearchAnalytics(client, body) {
  const url = `${API_BASE}/${encodeURIComponent(client.siteUrl)}/searchAnalytics/query`;
  for (let attempt = 1; ; attempt += 1) {
    const response = await client.fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${client.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      const parsed = answerSchema.safeParse(
        await response.json().catch(() => null),
      );
      if (!parsed.success)
        throw new Error("Search Console answered with an unexpected shape");
      return parsed.data.rows ?? [];
    }
    const retry = response.status === 429 || response.status >= 500;
    if (retry && attempt < MAX_ATTEMPTS) {
      await client.sleep(waitAfter(response, attempt));
      continue;
    }
    /** @type {{ error?: { status?: unknown } }} */
    const data = await response.json().catch(() => ({}));
    const word =
      typeof data.error?.status === "string" ? data.error.status : "unknown";
    const hint =
      response.status === 403 || response.status === 404
        ? ": check that the service account is a user of the property and that SEARCH_CONSOLE_SITE_URL is exactly the property"
        : "";
    throw new Error(
      `Search Console API answered ${response.status} (${word})${hint}`,
    );
  }
}

/**
 * Cleans the rows of a day: cuts the very long keys and adds up rows that became equal.
 * @param {DetailRow[]} rows - The rows as the API gave them.
 * @returns {DetailRow[]} Rows with a unique key. `ctr` is clicks over impressions and `position`
 * is the average weighted by impressions.
 */
export function mergeDuplicateRows(rows) {
  /** @type {Map<string, DetailRow & { weighted: number }>} */
  const merged = new Map();
  for (const row of rows) {
    const key = [row.query, row.page, row.country, row.device].join("\u0000");
    const found = merged.get(key);
    if (!found) {
      merged.set(key, { ...row, weighted: row.position * row.impressions });
      continue;
    }
    found.clicks += row.clicks;
    found.impressions += row.impressions;
    found.weighted += row.position * row.impressions;
  }
  return [...merged.values()].map(({ weighted, ...row }) => ({
    ...row,
    ctr: row.impressions > 0 ? row.clicks / row.impressions : 0,
    position: row.impressions > 0 ? weighted / row.impressions : row.position,
  }));
}

/**
 * Reads the totals of a day, as the Search Console screen shows them (anonymized queries
 * included).
 * @param {SearchConsoleClient} client - The connection.
 * @param {string} day - The day as `YYYY-MM-DD`.
 * @returns {Promise<MetricsRow>} The totals, zeros when Google has nothing for that day.
 */
export async function fetchDayTotals(client, day) {
  const rows =
    (await querySearchAnalytics(client, {
      startDate: day,
      endDate: day,
      dimensions: ["date"],
      rowLimit: 1,
    })) ?? [];
  const [row] = rows;
  return row
    ? {
        clicks: Math.round(row.clicks),
        impressions: Math.round(row.impressions),
        ctr: row.ctr,
        position: row.position,
      }
    : { clicks: 0, impressions: 0, ctr: 0, position: 0 };
}

/**
 * Reads the rows of a day by query, page, country and device, all the pages of the answer.
 * @param {SearchConsoleClient} client - The connection.
 * @param {string} day - The day as `YYYY-MM-DD`.
 * @returns {Promise<DetailRow[]>} The rows, clean and with a unique key.
 */
export async function fetchDayDetails(client, day) {
  /** @type {DetailRow[]} */
  const all = [];
  for (let startRow = 0; ; startRow += ROW_LIMIT) {
    const rows =
      (await querySearchAnalytics(client, {
        startDate: day,
        endDate: day,
        dimensions: ["query", "page", "country", "device"],
        rowLimit: ROW_LIMIT,
        startRow,
      })) ?? [];
    for (const row of rows) {
      const [query = "", page = "", country = "", device = ""] = row.keys;
      all.push({
        day,
        query: query.slice(0, QUERY_MAX),
        page: page.slice(0, PAGE_MAX),
        country,
        device,
        clicks: Math.round(row.clicks),
        impressions: Math.round(row.impressions),
        ctr: row.ctr,
        position: row.position,
      });
    }
    if (rows.length < ROW_LIMIT) break;
  }
  return mergeDuplicateRows(all);
}
