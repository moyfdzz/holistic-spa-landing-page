// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  API_BASE,
  fetchDayDetails,
  fetchDayTotals,
  MAX_ATTEMPTS,
  mergeDuplicateRows,
  PAGE_MAX,
  QUERY_MAX,
  querySearchAnalytics,
  ROW_LIMIT,
} from "./search-console.js";

/**
 * Builds a client with a scripted `fetch`.
 * @param {Array<Response | (() => Response)>} answers - What `fetch` answers, in order.
 * @returns {{ client: import("./search-console.js").SearchConsoleClient, fetchFn: ReturnType<typeof vi.fn>, sleeps: number[] }} The client and what it did.
 */
function scripted(answers) {
  const queue = [...answers];
  const fetchFn = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("the test did not script this request");
    return typeof next === "function" ? next() : next;
  });
  /** @type {number[]} */
  const sleeps = [];
  return {
    fetchFn,
    sleeps,
    client: {
      fetchFn: /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchFn)),
      token: "token-de-prueba",
      siteUrl: "sc-domain:masajesrelaxmty.com",
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
      },
    },
  };
}

/**
 * @param {string[]} keys - The dimension values.
 * @param {number} clicks - Clicks.
 * @param {number} impressions - Impressions.
 * @param {number} [position] - Average position.
 * @returns {{ keys: string[], clicks: number, impressions: number, ctr: number, position: number }} A row as the API gives it.
 */
const apiRow = (keys, clicks, impressions, position = 5) => ({
  keys,
  clicks,
  impressions,
  ctr: impressions > 0 ? clicks / impressions : 0,
  position,
});

describe("querySearchAnalytics", () => {
  it("posts the query to the documented address with the token", async () => {
    const { client, fetchFn } = scripted([
      Response.json({ rows: [apiRow(["masaje a domicilio"], 3, 40)] }),
    ]);
    const rows = await querySearchAnalytics(client, {
      startDate: "2026-10-20",
    });
    expect(rows).toHaveLength(1);
    const [url, init] = /** @type {[string, RequestInit]} */ (
      fetchFn.mock.calls[0]
    );
    expect(url).toBe(
      `${API_BASE}/sc-domain%3Amasajesrelaxmty.com/searchAnalytics/query`,
    );
    expect(init.method).toBe("POST");
    expect(
      /** @type {Record<string, string>} */ (init.headers).Authorization,
    ).toBe("Bearer token-de-prueba");
    expect(JSON.parse(String(init.body))).toEqual({ startDate: "2026-10-20" });
  });

  it("gives an empty list when Google has no rows", async () => {
    const { client } = scripted([Response.json({})]);
    expect(await querySearchAnalytics(client, {})).toEqual([]);
  });

  it("tries again after too many requests, waiting as long as Google asks", async () => {
    const { client, fetchFn, sleeps } = scripted([
      new Response("{}", { status: 429, headers: { "Retry-After": "3" } }),
      Response.json({ rows: [apiRow(["x"], 1, 2)] }),
    ]);
    const rows = await querySearchAnalytics(client, {});
    expect(rows).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([3000]);
  });

  it("tries again after a server failure with a growing wait", async () => {
    const { client, sleeps } = scripted([
      new Response("{}", { status: 503 }),
      new Response("{}", { status: 500 }),
      Response.json({ rows: [] }),
    ]);
    await querySearchAnalytics(client, {});
    expect(sleeps).toEqual([500, 1000]);
  });

  it("never waits more than ten seconds", async () => {
    const { client, sleeps } = scripted([
      new Response("{}", { status: 429, headers: { "Retry-After": "600" } }),
      Response.json({}),
    ]);
    await querySearchAnalytics(client, {});
    expect(sleeps).toEqual([10_000]);
  });

  it("gives up after the last try and says the status without the token", async () => {
    const answers = Array.from(
      { length: MAX_ATTEMPTS },
      () =>
        new Response(JSON.stringify({ error: { status: "UNAVAILABLE" } }), {
          status: 503,
        }),
    );
    const { client, fetchFn } = scripted(answers);
    await expect(querySearchAnalytics(client, {})).rejects.toThrow(
      "Search Console API answered 503 (UNAVAILABLE)",
    );
    expect(fetchFn).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("does not retry what will not pass, and says what to check on a permission error", async () => {
    const { client, fetchFn } = scripted([
      Response.json(
        { error: { status: "PERMISSION_DENIED" } },
        { status: 403 },
      ),
    ]);
    await expect(querySearchAnalytics(client, {})).rejects.toThrow(
      /403 \(PERMISSION_DENIED\): check that the service account is a user of the property/,
    );
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("never puts the token in an error", async () => {
    const { client } = scripted([new Response("{}", { status: 401 })]);
    try {
      await querySearchAnalytics(client, {});
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("token-de-prueba");
    }
  });

  it("refuses an answer with an unexpected shape", async () => {
    const { client } = scripted([Response.json({ rows: [{ keys: "no" }] })]);
    await expect(querySearchAnalytics(client, {})).rejects.toThrow(
      "unexpected shape",
    );
  });
});

describe("fetchDayTotals", () => {
  it("asks for the day grouped by date and gives its totals", async () => {
    const { client, fetchFn } = scripted([
      Response.json({ rows: [apiRow(["2026-10-28"], 7, 210, 8.4)] }),
    ]);
    const totals = await fetchDayTotals(client, "2026-10-28");
    expect(totals).toEqual({
      clicks: 7,
      impressions: 210,
      ctr: 7 / 210,
      position: 8.4,
    });
    const body = JSON.parse(String(fetchFn.mock.calls[0][1].body));
    expect(body).toMatchObject({
      startDate: "2026-10-28",
      endDate: "2026-10-28",
      dimensions: ["date"],
    });
  });

  it("gives zeros for a day Google has nothing for", async () => {
    const { client } = scripted([Response.json({})]);
    expect(await fetchDayTotals(client, "2026-10-28")).toEqual({
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 0,
    });
  });
});

describe("fetchDayDetails", () => {
  it("reads the rows with their dimensions in order", async () => {
    const { client, fetchFn } = scripted([
      Response.json({
        rows: [
          apiRow(
            [
              "masajes monterrey",
              "https://www.masajesrelaxmty.com/",
              "mex",
              "MOBILE",
            ],
            4,
            90,
            6.2,
          ),
          apiRow(
            [
              "masaje relajante",
              "https://www.masajesrelaxmty.com/",
              "mex",
              "DESKTOP",
            ],
            0,
            12,
            14,
          ),
        ],
      }),
    ]);
    const rows = await fetchDayDetails(client, "2026-10-28");
    expect(rows).toEqual([
      {
        day: "2026-10-28",
        query: "masajes monterrey",
        page: "https://www.masajesrelaxmty.com/",
        country: "mex",
        device: "MOBILE",
        clicks: 4,
        impressions: 90,
        ctr: 4 / 90,
        position: 6.2,
      },
      expect.objectContaining({
        query: "masaje relajante",
        device: "DESKTOP",
        clicks: 0,
      }),
    ]);
    expect(JSON.parse(String(fetchFn.mock.calls[0][1].body))).toMatchObject({
      dimensions: ["query", "page", "country", "device"],
      rowLimit: ROW_LIMIT,
      startRow: 0,
    });
  });

  it("asks for the next page while the answer is full, and stops at the first that is not", async () => {
    const full = Array.from({ length: ROW_LIMIT }, (_, index) =>
      apiRow([`q${index}`, "/p", "mex", "MOBILE"], 1, 2),
    );
    const { client, fetchFn } = scripted([
      Response.json({ rows: full }),
      Response.json({
        rows: [apiRow(["q-last", "/p", "mex", "MOBILE"], 1, 2)],
      }),
    ]);
    const rows = await fetchDayDetails(client, "2026-10-28");
    expect(rows).toHaveLength(ROW_LIMIT + 1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchFn.mock.calls[1][1].body)).startRow).toBe(
      ROW_LIMIT,
    );
  });

  it("gives an empty list for a quiet day", async () => {
    const { client } = scripted([Response.json({})]);
    expect(await fetchDayDetails(client, "2026-10-28")).toEqual([]);
  });

  it("cuts very long queries and pages, and adds up the rows that become equal", async () => {
    const long = "a".repeat(QUERY_MAX + 40);
    const longPage = `/${"b".repeat(PAGE_MAX + 40)}`;
    const { client } = scripted([
      Response.json({
        rows: [
          apiRow([`${long}1`, longPage, "mex", "MOBILE"], 1, 10, 4),
          apiRow([`${long}2`, longPage, "mex", "MOBILE"], 2, 30, 8),
        ],
      }),
    ]);
    const rows = await fetchDayDetails(client, "2026-10-28");
    expect(rows).toHaveLength(1);
    expect(rows[0].query).toHaveLength(QUERY_MAX);
    expect(rows[0].page).toHaveLength(PAGE_MAX);
    expect(rows[0]).toMatchObject({ clicks: 3, impressions: 40 });
    // The average position weighs each row by its impressions: (4*10 + 8*30) / 40 = 7.
    expect(rows[0].position).toBe(7);
    expect(rows[0].ctr).toBe(3 / 40);
  });
});

describe("mergeDuplicateRows", () => {
  it("keeps rows with different keys as they are", () => {
    const base = {
      day: "2026-10-28",
      query: "a",
      page: "/p",
      country: "mex",
      device: "MOBILE",
      clicks: 1,
      impressions: 2,
      ctr: 0.5,
      position: 3,
    };
    const rows = mergeDuplicateRows([base, { ...base, device: "DESKTOP" }]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(base);
  });

  it("does not divide by zero when the rows have no impressions", () => {
    const base = {
      day: "2026-10-28",
      query: "a",
      page: "/p",
      country: "mex",
      device: "MOBILE",
      clicks: 0,
      impressions: 0,
      ctr: 0,
      position: 9,
    };
    const [row] = mergeDuplicateRows([base, base]);
    expect(row.ctr).toBe(0);
    expect(row.position).toBe(9);
  });
});
