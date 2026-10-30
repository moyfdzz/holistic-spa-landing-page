/**
 * What the Sitio web page shows, worked out from the query API's answer. Pure functions.
 * @module server/admin/site
 */
import {
  formatCount,
  formatMilliseconds,
  formatPercent,
  formatScore,
} from "./format.js";

/** Names of the channels a visit can come from, in Spanish. */
const channelNames = /** @type {Record<string, string>} */ ({
  google_search: "Búsqueda de Google",
  google_maps: "Google Maps",
  bing: "Bing",
  instagram: "Instagram",
  facebook: "Facebook",
  whatsapp: "WhatsApp",
  other_site: "Otros sitios",
  direct: "Directo",
  internal: "Dentro del sitio",
  campaign: "Campañas con enlace",
});

/** Names of the device types, in Spanish. */
const deviceNames = /** @type {Record<string, string>} */ ({
  mobile: "Teléfono",
  tablet: "Tableta",
  desktop: "Computadora",
});

/** The state of the business: visits from elsewhere count as "outside". */
export const HOME_STATE = "Nuevo León";

/** Key the rollup uses for a value it could not read. */
const UNKNOWN = "(unknown)";

/**
 * @typedef {object} BarRow
 * @property {string} label - What the bar is.
 * @property {number} value - The number the bar measures.
 * @property {string} display - The number as it is written.
 * @property {number} share - Length of the bar, from 0 to 1, against the longest one.
 * @property {string} [note] - A short note after the number, for example the conversion.
 * @property {string[]} cells - The cells of this row in the table of numbers.
 */

/**
 * Makes bar rows from entries, longest first.
 * @param {Array<{ label: string, value: number, note?: string, cells: string[] }>} entries - The entries.
 * @returns {BarRow[]} The rows, without the ones that have nothing.
 */
function toBars(entries) {
  const shown = entries
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const longest = shown[0]?.value ?? 0;
  return shown.map((entry) => ({
    ...entry,
    display: formatCount(entry.value),
    share: longest > 0 ? entry.value / longest : 0,
  }));
}

/**
 * Rows of a breakdown by visitors.
 * @param {import("../analytics/query.js").BreakdownEntry[]} entries - The rows of the breakdown.
 * @param {(key: string) => string} name - Names a key.
 * @returns {BarRow[]} The bars.
 */
function byVisitors(entries, name) {
  return toBars(
    entries.map((entry) => ({
      label: name(entry.key),
      value: entry.visitors,
      cells: [name(entry.key), formatCount(entry.visitors)],
    })),
  );
}

/**
 * Names a key of a breakdown.
 * @param {string} key - A key of a breakdown.
 * @returns {string} The key, or "Sin datos" when the value could not be read.
 */
const plainName = (key) => (key === UNKNOWN ? "Sin datos" : key);

/**
 * Where the visits come from: sessions by the channel they started from, and how many of those
 * ended in a contact.
 * @param {import("../analytics/query.js").AnalyticsResult} result - The answer of the query API.
 * @returns {BarRow[]} The bars.
 */
export function buildSources(result) {
  const contacted = new Map(
    (result.breakdowns.contacted_channel ?? []).map((entry) => [
      entry.key,
      entry.sessions,
    ]),
  );
  return toBars(
    (result.breakdowns.channel ?? []).map((entry) => {
      const contacts = Math.min(contacted.get(entry.key) ?? 0, entry.sessions);
      const rate = entry.sessions > 0 ? contacts / entry.sessions : 0;
      const label = channelNames[entry.key] ?? plainName(entry.key);
      return {
        label,
        value: entry.sessions,
        note: `${formatPercent(rate)} contactaron`,
        // Three columns, so the table fits in a phone: the contacts and their share go together.
        cells: [
          label,
          formatCount(entry.sessions),
          `${formatCount(contacts)} (${formatPercent(rate)})`,
        ],
      };
    }),
  );
}

/**
 * Share of the visitors who are outside the home state, among the ones whose state is known.
 * @param {import("../analytics/query.js").BreakdownEntry[]} regions - The states, by visitors.
 * @returns {{ known: number, outside: number, share: number } | null} The counts, or null when no state is known.
 */
export function outsideShare(regions) {
  const known = regions.filter((entry) => entry.key !== UNKNOWN);
  const total = known.reduce((sum, entry) => sum + entry.visitors, 0);
  if (total === 0) return null;
  const home = known.find((entry) => entry.key === HOME_STATE)?.visitors ?? 0;
  return { known: total, outside: total - home, share: (total - home) / total };
}

/**
 * The three ratings of a speed measure.
 * @typedef {"good" | "needs" | "poor"} Rating
 */

/**
 * Limits of Core Web Vitals: up to `good` is good, over `poor` is poor.
 * @type {Record<string, { name: string, what: string, good: number, poor: number, format: (value: number) => string }>}
 */
export const vitalLimits = {
  lcp: {
    name: "LCP",
    what: "Qué tan rápido aparece lo principal de la página",
    good: 2500,
    poor: 4000,
    format: formatMilliseconds,
  },
  inp: {
    name: "INP",
    what: "Qué tan rápido responde al tocar o hacer clic",
    good: 200,
    poor: 500,
    format: formatMilliseconds,
  },
  cls: {
    name: "CLS",
    what: "Cuánto se mueve el contenido mientras carga",
    good: 0.1,
    poor: 0.25,
    format: formatScore,
  },
  fcp: {
    name: "FCP",
    what: "Cuándo aparece el primer contenido",
    good: 1800,
    poor: 3000,
    format: formatMilliseconds,
  },
  ttfb: {
    name: "TTFB",
    what: "Qué tan rápido responde el servidor",
    good: 800,
    poor: 1800,
    format: formatMilliseconds,
  },
};

/** The words and the sign of each rating: the color is never the only signal. */
export const ratingLabels =
  /** @type {Record<Rating, { text: string, mark: string }>} */ ({
    good: { text: "Bueno", mark: "✓" },
    needs: { text: "Necesita mejorar", mark: "!" },
    poor: { text: "Malo", mark: "✕" },
  });

/**
 * Rates a speed measure.
 * @param {string} metric - `lcp`, `inp`, `cls`, `fcp` or `ttfb`.
 * @param {number} value - The p75 of the measure.
 * @returns {Rating} Good up to the limit of good, poor above the limit of poor.
 */
export function rateVital(metric, value) {
  const limits = vitalLimits[metric];
  if (value <= limits.good) return "good";
  return value <= limits.poor ? "needs" : "poor";
}

/**
 * @typedef {object} VitalTile
 * @property {string} id - The metric.
 * @property {string} name - Its short name, for example `LCP`.
 * @property {string} what - What it measures, in words.
 * @property {number | null} value - The p75, or null when nobody measured it.
 * @property {string} display - The p75 as it is written, or `Sin datos`.
 * @property {Rating | null} rating - How good it is.
 * @property {string} limits - The limits of good and poor, written.
 * @property {number} samples - How many page views measured it.
 */

/**
 * Builds the tiles of the speed block.
 * @param {import("../analytics/query.js").Distributions} distributions - The medians and percentiles of the range.
 * @returns {VitalTile[]} A tile for each measure, the ones people feel first at the front.
 */
export function buildVitals(distributions) {
  return ["lcp", "inp", "cls", "fcp", "ttfb"].map((id) => {
    const limits = vitalLimits[id];
    const found = distributions[id];
    const value = found?.p75 ?? null;
    return {
      id,
      name: limits.name,
      what: limits.what,
      value,
      display: value === null ? "Sin datos" : limits.format(value),
      rating: value === null ? null : rateVital(id, value),
      limits: `Bueno hasta ${limits.format(limits.good)}. Malo desde más de ${limits.format(limits.poor)}.`,
      samples: found?.samples ?? 0,
    };
  });
}

/**
 * @typedef {object} SiteOverview
 * @property {boolean} empty - There are no events in the range.
 * @property {BarRow[]} sources - Sessions by the channel they started from.
 * @property {BarRow[]} devices - Visitors by type of device.
 * @property {BarRow[]} browsers - Visitors by browser.
 * @property {BarRow[]} states - Visitors by state.
 * @property {BarRow[]} cities - Visitors by city.
 * @property {{ known: number, outside: number, share: number } | null} outside - The visitors from outside the home state.
 * @property {VitalTile[]} vitals - The speed measures.
 */

/**
 * Turns the answer of the query API into what the Sitio web page shows.
 * @param {import("../analytics/query.js").AnalyticsResult} result - The answer of the query API.
 * @returns {SiteOverview} The blocks of the page.
 */
export function buildSite(result) {
  const { breakdowns } = result;
  return {
    empty: result.totals.events === 0,
    sources: buildSources(result),
    devices: byVisitors(
      breakdowns.device ?? [],
      (key) => deviceNames[key] ?? plainName(key),
    ),
    browsers: byVisitors(breakdowns.browser ?? [], plainName),
    states: byVisitors(breakdowns.region ?? [], plainName),
    cities: byVisitors(breakdowns.city ?? [], plainName),
    outside: outsideShare(breakdowns.region ?? []),
    vitals: buildVitals(result.distributions),
  };
}

/**
 * Address that downloads a table of the dashboard as CSV, for the range on screen.
 * @param {string} table - The table: `channel`, `region`, `city`, `device`, `browser`...
 * @param {{ from: string, to: string }} range - The range on screen.
 * @returns {string} The address of the export.
 */
export function csvHref(table, range) {
  const query = new URLSearchParams({ table, from: range.from, to: range.to });
  return `/api/admin/analytics/export?${query.toString()}`;
}
