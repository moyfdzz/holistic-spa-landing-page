import { describe, expect, it } from "vitest";
import { formatHour, getYearsSince } from "./date.js";

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

describe("formatHour", () => {
  it("uses the 24-hour clock in Spanish", () => {
    expect(formatHour("08:00", "es")).toBe("8:00");
    expect(formatHour("22:00", "es")).toBe("22:00");
  });

  it("uses am and pm in English", () => {
    expect(formatHour("08:00", "en")).toBe("8:00 am");
    expect(formatHour("22:00", "en")).toBe("10:00 pm");
    expect(formatHour("12:30", "en")).toBe("12:30 pm");
    expect(formatHour("00:15", "en")).toBe("12:15 am");
  });

  it("rejects text that is not a time", () => {
    expect(() => formatHour("8am", "en")).toThrow(TypeError);
  });
});
