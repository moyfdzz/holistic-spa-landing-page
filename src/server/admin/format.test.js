import { describe, expect, it } from "vitest";
import {
  formatAxisBucket,
  formatBucket,
  formatCount,
  formatDay,
  formatDecimal,
  formatDuration,
  formatPercent,
} from "./format.js";

/**
 * Durations and percentages join number and unit with a no-break space; the tests read them
 * with a normal one.
 * @param {string} text - The text.
 * @returns {string} The text with normal spaces.
 */
const plain = (text) => text.replaceAll("\u00a0", " ");

describe("numbers", () => {
  it("writes counts with thousands separators and at most one decimal", () => {
    expect(formatCount(1234567)).toBe("1,234,567");
    expect(formatDecimal(3.26)).toBe("3.3");
    expect(formatDecimal(3)).toBe("3");
  });

  it("writes a ratio as a percentage", () => {
    expect(plain(formatPercent(0.0321))).toBe("3.2 %");
    expect(plain(formatPercent(0))).toBe("0 %");
    expect(plain(formatPercent(1))).toBe("100 %");
  });
});

describe("formatDuration", () => {
  it("uses seconds, minutes and hours, and leaves out zero parts", () => {
    expect(plain(formatDuration(0))).toBe("0 s");
    expect(plain(formatDuration(45))).toBe("45 s");
    expect(plain(formatDuration(60))).toBe("1 min");
    expect(plain(formatDuration(185))).toBe("3 min 5 s");
    expect(plain(formatDuration(3600))).toBe("1 h");
    expect(plain(formatDuration(3900))).toBe("1 h 5 min");
  });

  it("never ends a line between a number and its unit", () => {
    expect(formatDuration(185)).toBe("3\u00a0min 5\u00a0s");
    expect(formatPercent(0.5)).toBe("50\u00a0%");
  });

  it("rounds and never goes below zero", () => {
    expect(plain(formatDuration(44.6))).toBe("45 s");
    expect(plain(formatDuration(-5))).toBe("0 s");
  });
});

describe("days and buckets", () => {
  it("writes a day in Spanish without moving it with the time zone", () => {
    expect(formatDay("2026-10-29")).toMatch(/^29 oct/);
    expect(formatDay("2026-11-01")).toMatch(/^1 nov/);
    expect(formatDay("2026-10-29", "long")).toBe("29 de octubre de 2026");
  });

  it("names each kind of bucket", () => {
    expect(formatBucket("2026-10-29", "day")).toMatch(/^29 oct/);
    expect(formatBucket("2026-10-26", "week")).toMatch(/^Semana del 26 oct/);
    expect(formatBucket("2026-10-01", "month")).toMatch(/^oct.* 2026$/);
    expect(formatBucket("2026-01-01", "year")).toBe("2026");
  });

  it("keeps the axis labels short", () => {
    expect(formatAxisBucket("2026-10-26", "week")).toMatch(/^26 oct/);
    expect(formatAxisBucket("2026-10-26", "day")).toMatch(/^26 oct/);
    expect(formatAxisBucket("2026-10-01", "month")).toMatch(/^oct.* 2026$/);
    expect(formatAxisBucket("2026-01-01", "year")).toBe("2026");
  });
});
