// @vitest-environment node
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { searchConsoleDaily, searchConsoleTotals } from "../db/schema.js";
import { importedRange, replaceSearchConsoleDay } from "./store.js";

const migrationsFolder = fileURLToPath(
  new URL("../../../drizzle", import.meta.url),
);

/**
 * @param {string} day - The day.
 * @param {Partial<import("./search-console.js").DetailRow>} [override] - What to change.
 * @returns {import("./search-console.js").DetailRow} A detail row.
 */
const detail = (day, override = {}) => ({
  day,
  query: "masajes a domicilio",
  page: "https://www.masajesrelaxmty.com/",
  country: "mex",
  device: "MOBILE",
  clicks: 2,
  impressions: 40,
  ctr: 0.05,
  position: 6.5,
  ...override,
});

const totals = { clicks: 5, impressions: 100, ctr: 0.05, position: 7.25 };

describe("Search Console store (in-memory Postgres)", () => {
  const db = drizzle(new PGlite());

  beforeAll(async () => {
    await migrate(db, { migrationsFolder });
  });

  beforeEach(async () => {
    await db.delete(searchConsoleDaily);
    await db.delete(searchConsoleTotals);
  });

  it("writes the details and the totals of a day", async () => {
    const written = await replaceSearchConsoleDay(db, "2026-10-28", totals, [
      detail("2026-10-28"),
      detail("2026-10-28", { query: "masaje relajante", device: "DESKTOP" }),
    ]);
    expect(written).toEqual({ details: 2, removed: 0 });
    expect(await db.select().from(searchConsoleDaily)).toHaveLength(2);
    const [row] = await db.select().from(searchConsoleTotals);
    expect(row).toMatchObject({
      day: "2026-10-28",
      clicks: 5,
      impressions: 100,
    });
    expect(row.position).toBe(7.25);
  });

  it("gives the same result when it runs twice", async () => {
    const rows = [detail("2026-10-28")];
    await replaceSearchConsoleDay(db, "2026-10-28", totals, rows);
    const first = await db.select().from(searchConsoleDaily);
    await replaceSearchConsoleDay(db, "2026-10-28", totals, rows);
    expect(await db.select().from(searchConsoleDaily)).toEqual(first);
    expect(await db.select().from(searchConsoleTotals)).toHaveLength(1);
  });

  it("updates the numbers of a row Google changed", async () => {
    await replaceSearchConsoleDay(db, "2026-10-28", totals, [
      detail("2026-10-28"),
    ]);
    await replaceSearchConsoleDay(db, "2026-10-28", { ...totals, clicks: 9 }, [
      detail("2026-10-28", { clicks: 9, impressions: 55 }),
    ]);
    const [row] = await db.select().from(searchConsoleDaily);
    expect(row).toMatchObject({ clicks: 9, impressions: 55 });
    const [sum] = await db.select().from(searchConsoleTotals);
    expect(sum.clicks).toBe(9);
  });

  it("removes the rows Google no longer gives for that day", async () => {
    await replaceSearchConsoleDay(db, "2026-10-28", totals, [
      detail("2026-10-28"),
      detail("2026-10-28", { query: "otra búsqueda" }),
    ]);
    const written = await replaceSearchConsoleDay(db, "2026-10-28", totals, [
      detail("2026-10-28"),
    ]);
    expect(written.removed).toBe(1);
    const rows = await db.select().from(searchConsoleDaily);
    expect(rows.map((row) => row.query)).toEqual(["masajes a domicilio"]);
  });

  it("leaves the other days alone", async () => {
    await replaceSearchConsoleDay(db, "2026-10-27", totals, [
      detail("2026-10-27"),
    ]);
    await replaceSearchConsoleDay(db, "2026-10-28", totals, []);
    const rows = await db.select().from(searchConsoleDaily);
    expect(rows.map((row) => row.day)).toEqual(["2026-10-27"]);
    expect(await db.select().from(searchConsoleTotals)).toHaveLength(2);
  });

  it("marks a quiet day as imported with a row of zeros", async () => {
    await replaceSearchConsoleDay(
      db,
      "2026-10-20",
      { clicks: 0, impressions: 0, ctr: 0, position: 0 },
      [],
    );
    expect(await db.select().from(searchConsoleDaily)).toEqual([]);
    expect(await importedRange(db)).toEqual({
      earliest: "2026-10-20",
      latest: "2026-10-20",
    });
  });

  it("keeps quotes, accents, emojis and backslashes of a query as they are", async () => {
    const query = `masaje "relajante" \\ café ñ 💆 'x' ; drop table search_console_daily; --`;
    await replaceSearchConsoleDay(db, "2026-10-28", totals, [
      detail("2026-10-28", { query }),
    ]);
    const [row] = await db.select().from(searchConsoleDaily);
    expect(row.query).toBe(query);
    expect(await db.select().from(searchConsoleTotals)).toHaveLength(1);
  });

  it("tells the first and the last day imported", async () => {
    expect(await importedRange(db)).toEqual({ earliest: null, latest: null });
    await replaceSearchConsoleDay(db, "2026-10-12", totals, []);
    await replaceSearchConsoleDay(db, "2026-10-28", totals, []);
    await replaceSearchConsoleDay(db, "2026-10-20", totals, []);
    expect(await importedRange(db)).toEqual({
      earliest: "2026-10-12",
      latest: "2026-10-28",
    });
  });
});
