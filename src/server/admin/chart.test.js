import { describe, expect, it } from "vitest";
import {
  bucketOf,
  bucketStarts,
  buildLineChart,
  describeSeries,
  fillVisitors,
  niceTicks,
  pickLabelIndexes,
} from "./chart.js";

describe("bucketOf", () => {
  it("gives the first day of the day, week, month and year", () => {
    // 29 Oct 2026 is a Thursday.
    expect(bucketOf("2026-10-29", "day")).toBe("2026-10-29");
    expect(bucketOf("2026-10-29", "week")).toBe("2026-10-26");
    expect(bucketOf("2026-10-26", "week")).toBe("2026-10-26");
    expect(bucketOf("2026-11-01", "week")).toBe("2026-10-26");
    expect(bucketOf("2026-10-29", "month")).toBe("2026-10-01");
    expect(bucketOf("2026-10-29", "year")).toBe("2026-01-01");
  });
});

describe("bucketStarts", () => {
  it("lists every day of a range, ends included", () => {
    expect(bucketStarts("2026-10-30", "2026-11-02", "day")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });

  it("lists the weeks that touch the range, starting on Monday", () => {
    expect(bucketStarts("2026-10-29", "2026-11-04", "week")).toEqual([
      "2026-10-26",
      "2026-11-02",
    ]);
  });

  it("lists months and years, also across the new year", () => {
    expect(bucketStarts("2026-11-15", "2027-02-10", "month")).toEqual([
      "2026-11-01",
      "2026-12-01",
      "2027-01-01",
      "2027-02-01",
    ]);
    expect(bucketStarts("2026-06-01", "2028-01-01", "year")).toEqual([
      "2026-01-01",
      "2027-01-01",
      "2028-01-01",
    ]);
  });

  it("gives one bucket for a single day", () => {
    expect(bucketStarts("2026-10-29", "2026-10-29", "day")).toEqual([
      "2026-10-29",
    ]);
  });
});

describe("fillVisitors", () => {
  it("puts zero on the buckets without data", () => {
    const starts = bucketStarts("2026-10-29", "2026-11-01", "day");
    expect(
      fillVisitors(
        [
          { bucket: "2026-10-29", visitors: 5 },
          { bucket: "2026-11-01", visitors: 2 },
        ],
        starts,
      ),
    ).toEqual([5, 0, 0, 2]);
  });
});

describe("niceTicks", () => {
  it("rounds the top up to a tidy number and keeps counts whole", () => {
    expect(niceTicks(87).max).toBeGreaterThanOrEqual(87);
    for (const max of [1, 3, 7, 18, 87, 130, 4200, 99999]) {
      const { ticks, max: top } = niceTicks(max);
      expect(top).toBeGreaterThanOrEqual(max);
      expect(ticks[0]).toBe(0);
      expect(ticks[ticks.length - 1]).toBe(top);
      expect(ticks.every(Number.isInteger)).toBe(true);
      expect(ticks.length).toBeLessThanOrEqual(7);
    }
  });

  it("gives a usable axis when everything is zero", () => {
    expect(niceTicks(0)).toEqual({ max: 1, ticks: [0, 1] });
  });
});

describe("pickLabelIndexes", () => {
  it("labels every point when there are few, and spreads the labels otherwise", () => {
    expect(pickLabelIndexes(0)).toEqual([]);
    expect(pickLabelIndexes(1)).toEqual([0]);
    expect(pickLabelIndexes(3)).toEqual([0, 1, 2]);
    const picked = pickLabelIndexes(30);
    expect(picked[0]).toBe(0);
    expect(picked[picked.length - 1]).toBe(29);
    expect(picked).toHaveLength(4);
  });
});

describe("buildLineChart", () => {
  it("puts the biggest value at the top of the plot and zero on the baseline", () => {
    const chart = buildLineChart({ values: [0, 10, 20] });
    expect(chart.points[2].y).toBeLessThan(chart.points[1].y);
    expect(chart.points[0].y).toBe(chart.plot.bottom);
    expect(chart.points[0].x).toBe(chart.plot.left);
    expect(chart.points[2].x).toBe(chart.plot.right);
  });

  it("draws the line and the area under it", () => {
    const chart = buildLineChart({ values: [1, 2, 3] });
    expect(chart.line.startsWith("M")).toBe(true);
    expect(chart.line.match(/L/g)).toHaveLength(2);
    expect(chart.area.endsWith("Z")).toBe(true);
  });

  it("puts a single point in the middle and draws no area", () => {
    const chart = buildLineChart({ values: [4] });
    const middle = (chart.plot.left + chart.plot.right) / 2;
    expect(chart.points[0].x).toBe(middle);
    expect(chart.area).toBe("");
  });

  it("draws the previous period on the same scale", () => {
    const chart = buildLineChart({ values: [1, 2, 3], previous: [10, 2, 3] });
    expect(chart.max).toBeGreaterThanOrEqual(10);
    expect(chart.previousLine.startsWith("M")).toBe(true);
    expect(chart.previousPoints).toHaveLength(3);
  });

  it("cuts a longer previous period to the points of the current one", () => {
    const chart = buildLineChart({ values: [1, 2], previous: [1, 2, 3, 4] });
    expect(chart.previousPoints).toHaveLength(2);
  });

  it("has no previous line without a previous period", () => {
    expect(buildLineChart({ values: [1, 2] }).previousLine).toBe("");
    expect(
      buildLineChart({ values: [1, 2], previous: null }).previousPoints,
    ).toEqual([]);
  });

  it("keeps every coordinate inside the drawing", () => {
    const chart = buildLineChart({
      values: [0, 50, 3, 120, 7],
      previous: [200, 0, 0, 0, 0],
    });
    for (const point of [...chart.points, ...chart.previousPoints]) {
      expect(point.x).toBeGreaterThanOrEqual(chart.plot.left);
      expect(point.x).toBeLessThanOrEqual(chart.plot.right);
      expect(point.y).toBeGreaterThanOrEqual(chart.plot.top);
      expect(point.y).toBeLessThanOrEqual(chart.plot.bottom);
    }
  });

  it("works with no data at all", () => {
    const chart = buildLineChart({ values: [] });
    expect(chart.points).toEqual([]);
    expect(chart.line).toBe("");
  });
});

describe("describeSeries", () => {
  const buckets = ["2026-10-29", "2026-10-30", "2026-10-31"];

  it("gives the total, the peak and the previous total", () => {
    const text = describeSeries({
      what: "Visitantes",
      buckets,
      values: [3, 9, 4],
      granularity: "day",
      previousTotal: 10,
    });
    expect(text).toContain("Visitantes por día: 16 en total.");
    expect(text).toContain("30 oct con 9");
    expect(text).toContain("En el periodo anterior fueron 10.");
  });

  it("does not make up a peak when there were no visits", () => {
    const text = describeSeries({
      what: "Visitantes",
      buckets,
      values: [0, 0, 0],
      granularity: "week",
    });
    expect(text).toContain("por semana");
    expect(text).toContain("Nadie visitó el sitio");
    expect(text).not.toContain("punto más alto");
  });

  it("says so when there is no data", () => {
    expect(
      describeSeries({
        what: "Visitantes",
        buckets: [],
        values: [],
        granularity: "day",
      }),
    ).toBe("Visitantes: sin datos en este periodo.");
  });
});
