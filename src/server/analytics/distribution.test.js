import { describe, expect, it } from "vitest";
import {
  bucketCount,
  bucketIndex,
  distributionBounds,
  emptyBuckets,
  histogramOf,
  mergeBuckets,
  percentileOf,
  summarize,
} from "./distribution.js";

const metric = "engaged_seconds";

describe("buckets", () => {
  it("has one bucket per bound and one for what is above them", () => {
    expect(bucketCount(metric)).toBe(distributionBounds[metric].length + 1);
    expect(emptyBuckets(metric).every((count) => count === 0)).toBe(true);
  });

  it("puts a value in the first bucket whose bound is not smaller than it", () => {
    expect(bucketIndex(metric, 0)).toBe(0);
    expect(bucketIndex(metric, 5)).toBe(0);
    expect(bucketIndex(metric, 5.1)).toBe(1);
    expect(bucketIndex(metric, 3600)).toBe(
      distributionBounds[metric].length - 1,
    );
    expect(bucketIndex(metric, 3601)).toBe(distributionBounds[metric].length);
  });
});

describe("histogramOf", () => {
  it("counts the samples and ignores what is not a valid measure", () => {
    const buckets = histogramOf(metric, [1, 4, 8, Number.NaN, -3, Infinity]);
    expect(buckets[0]).toBe(2);
    expect(buckets[1]).toBe(1);
    expect(buckets.reduce((sum, count) => sum + count, 0)).toBe(3);
  });
});

describe("mergeBuckets", () => {
  it("adds histograms bucket by bucket", () => {
    const a = histogramOf(metric, [1, 8]);
    const b = histogramOf(metric, [2, 9, 100]);
    const merged = mergeBuckets(metric, [a, b]);
    expect(merged[0]).toBe(2);
    expect(merged[1]).toBe(2);
    expect(merged.reduce((sum, count) => sum + count, 0)).toBe(5);
  });

  it("ignores a histogram of the wrong length", () => {
    const a = histogramOf(metric, [1]);
    expect(mergeBuckets(metric, [a, [1, 2, 3]])).toEqual(a);
  });
});

describe("percentileOf", () => {
  it("is null when there are no samples", () => {
    expect(percentileOf(metric, emptyBuckets(metric), 50)).toBeNull();
  });

  it("places the value inside the bucket that holds it", () => {
    // Four samples in the 10 to 20 second bucket: the median is halfway through it.
    const buckets = histogramOf(metric, [11, 12, 13, 14]);
    expect(percentileOf(metric, buckets, 50)).toBe(15);
    expect(percentileOf(metric, buckets, 100)).toBe(20);
  });

  it("follows the samples across buckets", () => {
    // Two quick visits and two long ones: the median sits at the top of the quick bucket.
    const buckets = histogramOf(metric, [3, 4, 400, 500]);
    expect(percentileOf(metric, buckets, 50)).toBe(5);
    expect(percentileOf(metric, buckets, 75)).toBe(450);
  });

  it("gives the last bound for what is above every bound", () => {
    const buckets = histogramOf(metric, [5000, 9000]);
    expect(percentileOf(metric, buckets, 50)).toBe(3600);
  });

  it("stays inside 0 to 100 percent", () => {
    const buckets = histogramOf(metric, [7]);
    expect(percentileOf(metric, buckets, -10)).toBe(
      percentileOf(metric, buckets, 0),
    );
    expect(percentileOf(metric, buckets, 500)).toBe(
      percentileOf(metric, buckets, 100),
    );
  });

  it("gives the same answer for one big histogram and for the sum of its days", () => {
    const day1 = [3, 12, 40, 250];
    const day2 = [6, 15, 70, 700];
    const whole = histogramOf(metric, [...day1, ...day2]);
    const summed = mergeBuckets(metric, [
      histogramOf(metric, day1),
      histogramOf(metric, day2),
    ]);
    expect(summed).toEqual(whole);
    expect(summarize(metric, summed)).toEqual(summarize(metric, whole));
  });
});

describe("summarize", () => {
  it("gives samples, median and p75", () => {
    const summary = summarize(metric, histogramOf(metric, [11, 12, 13, 14]));
    expect(summary).toEqual({ samples: 4, p50: 15, p75: 17.5 });
  });
});

describe("speed metrics", () => {
  it("have the limits of good and poor of each Core Web Vital as bounds", () => {
    const limits = {
      lcp: [2500, 4000],
      inp: [200, 500],
      cls: [0.1, 0.25],
      fcp: [1800, 3000],
      ttfb: [800, 1800],
    };
    for (const [name, [good, poor]] of Object.entries(limits)) {
      const bounds = /** @type {readonly number[]} */ (
        distributionBounds[
          /** @type {keyof typeof distributionBounds} */ (name)
        ]
      );
      expect(bounds, name).toContain(good);
      expect(bounds, name).toContain(poor);
    }
  });

  it("keep three decimals so a layout shift score is not rounded away", () => {
    const buckets = histogramOf("cls", [0.06, 0.07, 0.08, 0.09]);
    // Four samples in the 0.05 to 0.1 bucket: the median is halfway.
    expect(percentileOf("cls", buckets, 50)).toBe(0.075);
  });
});
