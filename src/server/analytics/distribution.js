/**
 * Histograms for measures that cannot be added up as plain totals (the active time of a session,
 * the Core Web Vitals). A day keeps the count of samples per bucket; the histograms of several
 * days are summed and a median or a percentile is read from the sum. Pure functions.
 * @module server/analytics/distribution
 */

/**
 * Upper bounds of the buckets of each metric, in the unit of the metric. A sample goes in the
 * first bucket whose bound is not smaller than it; anything above the last bound goes in one
 * extra bucket at the end. Changing a list would change what stored days mean, so only append
 * metrics.
 */
export const distributionBounds = /** @type {const} */ ({
  /** Seconds a visitor was active in one session. */
  engaged_seconds: [5, 10, 20, 30, 60, 120, 180, 300, 600, 1200, 1800, 3600],
  // The next five come from the `web_vital` event, one sample per page view. The "good" and
  // "poor" limits of each (2500 and 4000 ms for LCP, and so on) are bounds, so shares can be read.
  /** Largest Contentful Paint, in milliseconds. */
  lcp: [500, 1000, 1500, 2000, 2500, 3000, 4000, 6000, 10000],
  /** Interaction to Next Paint, in milliseconds. */
  inp: [50, 100, 200, 300, 500, 1000, 2000],
  /** Cumulative Layout Shift, a score without unit. */
  cls: [0.01, 0.05, 0.1, 0.15, 0.25, 0.5, 1],
  /** First Contentful Paint, in milliseconds. */
  fcp: [500, 1000, 1800, 2500, 3000, 4000, 6000],
  /** Time to First Byte, in milliseconds. */
  ttfb: [200, 400, 800, 1200, 1800, 3000],
});

/** The metrics that come from the `web_vital` event, in the order shown. */
export const vitalMetrics = /** @type {const} */ ([
  "lcp",
  "inp",
  "cls",
  "fcp",
  "ttfb",
]);

/** @typedef {keyof typeof distributionBounds} DistributionMetric */

/**
 * Number of buckets of a metric: one per bound and one for what is above the last bound.
 * @param {DistributionMetric} metric - The metric.
 * @returns {number} The count.
 */
export function bucketCount(metric) {
  return distributionBounds[metric].length + 1;
}

/**
 * An empty histogram.
 * @param {DistributionMetric} metric - The metric.
 * @returns {number[]} Zeros, one per bucket.
 */
export function emptyBuckets(metric) {
  return new Array(bucketCount(metric)).fill(0);
}

/**
 * Index of the bucket a sample belongs to.
 * @param {DistributionMetric} metric - The metric.
 * @param {number} value - The sample.
 * @returns {number} The index, the last one for a value above every bound.
 */
export function bucketIndex(metric, value) {
  const bounds = distributionBounds[metric];
  const index = bounds.findIndex((bound) => value <= bound);
  return index === -1 ? bounds.length : index;
}

/**
 * Builds a histogram from samples. Samples that are not finite numbers or are negative are
 * ignored.
 * @param {DistributionMetric} metric - The metric.
 * @param {number[]} values - The samples.
 * @returns {number[]} The count per bucket.
 */
export function histogramOf(metric, values) {
  const buckets = emptyBuckets(metric);
  for (const value of values) {
    if (Number.isFinite(value) && value >= 0)
      buckets[bucketIndex(metric, value)] += 1;
  }
  return buckets;
}

/**
 * Sums histograms of the same metric, for example one per day.
 * @param {DistributionMetric} metric - The metric.
 * @param {number[][]} list - The histograms. One with the wrong length is ignored.
 * @returns {number[]} The sum.
 */
export function mergeBuckets(metric, list) {
  const total = emptyBuckets(metric);
  for (const buckets of list) {
    if (buckets.length !== total.length) continue;
    buckets.forEach((count, index) => {
      total[index] += count;
    });
  }
  return total;
}

/**
 * Reads a percentile from a histogram. Inside the bucket that holds it, the value is placed
 * linearly between the bounds, so the error is at most the width of one bucket. The last bucket
 * has no upper bound, so a percentile that falls in it is the last bound.
 * @param {DistributionMetric} metric - The metric.
 * @param {number[]} buckets - The count per bucket.
 * @param {number} percent - From 0 to 100 (50 is the median).
 * @returns {number | null} The value, or null when there are no samples.
 */
export function percentileOf(metric, buckets, percent) {
  const bounds = distributionBounds[metric];
  const samples = buckets.reduce((sum, count) => sum + count, 0);
  if (samples === 0) return null;
  const rank = (Math.min(Math.max(percent, 0), 100) / 100) * samples;
  let seen = 0;
  for (let index = 0; index < buckets.length; index += 1) {
    const count = buckets[index];
    if (count > 0 && seen + count >= rank) {
      if (index >= bounds.length) return bounds[bounds.length - 1];
      const low = index === 0 ? 0 : bounds[index - 1];
      const high = bounds[index];
      return (
        Math.round((low + ((rank - seen) / count) * (high - low)) * 1000) / 1000
      );
    }
    seen += count;
  }
  return bounds[bounds.length - 1];
}

/**
 * Median and p75 of a histogram, and how many samples it has.
 * @param {DistributionMetric} metric - The metric.
 * @param {number[]} buckets - The count per bucket.
 * @returns {{ samples: number, p50: number | null, p75: number | null }} The summary.
 */
export function summarize(metric, buckets) {
  return {
    samples: buckets.reduce((sum, count) => sum + count, 0),
    p50: percentileOf(metric, buckets, 50),
    p75: percentileOf(metric, buckets, 75),
  };
}
