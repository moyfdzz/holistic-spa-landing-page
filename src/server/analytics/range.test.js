import { describe, expect, it } from "vitest";
import { compareValues, daysBetween, resolveRange } from "./range.js";

// 2026-11-15 18:00 in Monterrey (UTC-6) is 2026-11-16 00:00 UTC: the day in Monterrey is still the 15th.
const now = new Date("2026-11-16T00:00:00Z");

describe("resolveRange", () => {
  it("uses the day in Monterrey, not the UTC day", () => {
    expect(resolveRange({ range: "today" }, now)).toMatchObject({
      from: "2026-11-15",
      to: "2026-11-15",
    });
  });

  it("covers the presets", () => {
    expect(resolveRange({ range: "7d" }, now)).toMatchObject({
      from: "2026-11-09",
      to: "2026-11-15",
    });
    expect(resolveRange({ range: "30d" }, now)).toMatchObject({
      from: "2026-10-29",
      to: "2026-11-15",
    });
    expect(resolveRange({ range: "month" }, now)).toMatchObject({
      from: "2026-11-01",
      to: "2026-11-15",
    });
    expect(resolveRange({ range: "year" }, now)).toMatchObject({
      from: "2026-10-29",
      to: "2026-11-15",
    });
    expect(resolveRange({ range: "all" }, now)).toMatchObject({
      from: "2026-10-29",
      to: "2026-11-15",
    });
  });

  it("defaults to 30 days and ignores a wrong query", () => {
    expect(resolveRange({}, now).preset).toBe("30d");
    expect(resolveRange({ range: "nope" }, now).preset).toBe("30d");
    expect(
      resolveRange({ range: "custom", from: "x", to: "y" }, now).preset,
    ).toBe("30d");
  });

  it("never starts before the launch and never goes into the future", () => {
    expect(
      resolveRange({ range: "30d" }, new Date("2026-11-02T12:00:00Z")).from,
    ).toBe("2026-10-29");
    expect(
      resolveRange(
        { range: "custom", from: "2026-11-10", to: "2027-01-01" },
        now,
      ).to,
    ).toBe("2026-11-15");
  });

  it("swaps a custom range given backwards", () => {
    expect(
      resolveRange(
        { range: "custom", from: "2026-11-12", to: "2026-11-05" },
        now,
      ),
    ).toMatchObject({ from: "2026-11-05", to: "2026-11-12" });
  });

  it("gives the previous period with the same length", () => {
    const range = resolveRange({ range: "7d" }, now);
    expect(range.previous).toEqual({ from: "2026-11-02", to: "2026-11-08" });
    expect(daysBetween(range.previous.from, range.previous.to)).toBe(7);
  });
});

describe("compareValues", () => {
  it("gives percent and direction", () => {
    expect(compareValues(150, 100)).toEqual({ percent: 50, direction: "up" });
    expect(compareValues(50, 100)).toEqual({ percent: -50, direction: "down" });
    expect(compareValues(10, 10)).toEqual({ percent: 0, direction: "same" });
  });

  it("does not divide by zero", () => {
    expect(compareValues(5, 0)).toEqual({ percent: null, direction: "new" });
    expect(compareValues(0, 0)).toEqual({ percent: null, direction: "same" });
  });
});
