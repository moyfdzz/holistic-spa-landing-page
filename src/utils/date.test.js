import { describe, expect, it } from "vitest";
import { getYearsSince } from "./date.js";

describe("getYearsSince", () => {
  const now = new Date("2026-10-11T12:00:00Z");

  it("returns the whole years since the start year", () => {
    expect(getYearsSince(2017, now)).toBe(9);
  });

  it("returns 0 for the current year", () => {
    expect(getYearsSince(2026, now)).toBe(0);
  });

  it("uses today's date when no date is given", () => {
    expect(getYearsSince(new Date().getFullYear())).toBe(0);
  });

  it("rejects years that are not integers", () => {
    expect(() => getYearsSince(2017.5, now)).toThrow(TypeError);
    expect(() => getYearsSince(Number.NaN, now)).toThrow(TypeError);
    // @ts-expect-error - checking a wrong type on purpose
    expect(() => getYearsSince("2017", now)).toThrow(TypeError);
  });

  it("rejects years in the future", () => {
    expect(() => getYearsSince(2027, now)).toThrow(RangeError);
  });
});
