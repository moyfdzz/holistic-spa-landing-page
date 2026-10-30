/**
 * What the Sitio web page shows, worked out from the query API's answer. Pure functions.
 * @module server/admin/site
 */
import { faq } from "../../data/faq.js";
import { services } from "../../data/services.js";
import {
  formatCount,
  formatDecimal,
  formatDuration,
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
 * Makes bar rows from entries. Longest first, unless `ordered` keeps the order they came in (the
 * steps of a funnel, the depths of a scroll) and keeps the steps that have nothing.
 * @param {Array<{ label: string, value: number, note?: string, cells: string[] }>} entries - The entries.
 * @param {boolean} [ordered] - Keep the order and the empty entries.
 * @returns {BarRow[]} The rows.
 */
function toBars(entries, ordered = false) {
  const shown = ordered
    ? entries
    : entries
        .filter((entry) => entry.value > 0)
        .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  const longest = Math.max(0, ...shown.map((entry) => entry.value));
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
 * @property {Engagement} engagement - What the visitors do on the site.
 * @property {BarRow[]} funnel - The contact funnel.
 * @property {BarRow[]} contactWays - Clicks to WhatsApp, phone and email.
 * @property {BarRow[]} whatsappPlaces - Where the WhatsApp links were pressed.
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
    engagement: buildEngagement(result),
    funnel: buildFunnel(result),
    contactWays: buildContactWays(result),
    whatsappPlaces: buildWhatsappPlaces(breakdowns.whatsapp ?? []),
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

/** Names of the pages of the site, in Spanish. */
const pageNames = /** @type {Record<string, string>} */ ({
  "/": "Inicio",
  "/en/": "Inicio (en inglés)",
  "/contact": "Contacto",
  "/en/contact": "Contacto (en inglés)",
  "/aviso-de-privacidad": "Aviso de privacidad",
  "/en/privacy-notice": "Aviso de privacidad (en inglés)",
});

/** Names of the places of the WhatsApp links, in Spanish. */
const whatsappPlaces = /** @type {Record<string, string>} */ ({
  floating: "Botón flotante",
  hero: "Portada",
  service_card: "Tarjeta de servicio",
  contact: "Página de contacto",
  footer: "Pie de página",
});

/**
 * Names a page by its path.
 * @param {string} path - The path, for example `/en/contact`.
 * @returns {string} The name, or the path itself when the page is not one of the known ones.
 */
export function pageName(path) {
  return pageNames[path] ?? path;
}

/**
 * Names a service by the slug the tracker sends.
 * @param {string} slug - The slug, for example `relajante`.
 * @returns {string} The name in Spanish, or the slug when no service has it.
 */
export function serviceName(slug) {
  return services.find((item) => item.slug === slug)?.text.es.name ?? slug;
}

/**
 * Names a question of the FAQ by the id the tracker sends.
 * @param {string} id - The id, for example `booking`.
 * @returns {string} The question in Spanish, or the id when no question has it.
 */
export function faqName(id) {
  return faq.find((item) => item.id === id)?.text.es.question ?? id;
}

/**
 * Rows of a breakdown by the number of times something happened.
 * @param {import("../analytics/query.js").BreakdownEntry[]} entries - The rows of the breakdown.
 * @param {"events" | "pageViews" | "sessions" | "visitors"} field - What to measure.
 * @param {(key: string) => string} name - Names a key.
 * @returns {BarRow[]} The bars.
 */
function byField(entries, field, name) {
  return toBars(
    entries.map((entry) => ({
      label: name(entry.key),
      value: entry[field],
      cells: [name(entry.key), formatCount(entry[field])],
    })),
  );
}

/** The depths the tracker reports, with the words for each. */
const scrollSteps = /** @type {const} */ ([
  ["0", "Casi no bajaron"],
  ["25", "Hasta un cuarto de la página"],
  ["50", "Hasta la mitad"],
  ["75", "Hasta tres cuartos"],
  ["100", "Llegaron hasta el final"],
]);

/**
 * How far down the page the visits got, as a share of the page views that were measured.
 * @param {import("../analytics/query.js").BreakdownEntry[]} entries - The `scroll` breakdown.
 * @returns {BarRow[]} The five depths in order, or nothing when no page view was measured.
 */
export function buildScroll(entries) {
  const counts = new Map(entries.map((entry) => [entry.key, entry.events]));
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  if (total === 0) return [];
  return toBars(
    scrollSteps.map(([key, label]) => {
      const count = counts.get(key) ?? 0;
      return {
        label,
        value: count,
        note: formatPercent(count / total),
        cells: [label, formatCount(count), formatPercent(count / total)],
      };
    }),
    true,
  );
}

/**
 * @typedef {object} Engagement
 * @property {import("./overview.js").Tile[]} tiles - Active time, median, bounce rate and pages per session.
 * @property {BarRow[]} scroll - How far down the page the visits got.
 * @property {BarRow[]} pages - The pages with more views.
 * @property {BarRow[]} landing - The pages where the sessions start.
 * @property {BarRow[]} services - The services whose card was seen more times.
 * @property {BarRow[]} faq - The questions opened more times.
 * @property {BarRow[]} languages - Visitors by language.
 */

/**
 * What the visitors do on the site.
 * @param {import("../analytics/query.js").AnalyticsResult} result - The answer of the query API.
 * @returns {Engagement} The tiles and the lists.
 */
export function buildEngagement(result) {
  const { totals, distributions, breakdowns } = result;
  const median = distributions.engaged_seconds?.p50 ?? null;
  const perSession =
    totals.sessions > 0 ? totals.pageViews / totals.sessions : 0;
  return {
    tiles: [
      {
        id: "engaged",
        label: "Tiempo activo",
        value: totals.avgEngagedSeconds,
        display: formatDuration(totals.avgEngagedSeconds),
        note: "Promedio por sesión",
      },
      {
        id: "median",
        label: "Tiempo activo (mediana)",
        value: median ?? 0,
        display: median === null ? "Sin datos" : formatDuration(median),
        note: "La mitad de las sesiones duró menos que esto",
      },
      {
        id: "bounce",
        label: "Rebote",
        value: Math.round(totals.bounceRate * 1000) / 10,
        display: formatPercent(totals.bounceRate),
        note: "Sesiones de una sola página y menos de 10 segundos",
      },
      {
        id: "pages",
        label: "Páginas por sesión",
        value: Math.round(perSession * 10) / 10,
        display: formatDecimal(perSession),
      },
    ],
    scroll: buildScroll(breakdowns.scroll ?? []),
    pages: byField(breakdowns.path ?? [], "pageViews", pageName),
    landing: byField(breakdowns.path ?? [], "sessions", pageName),
    services: byField(breakdowns.service ?? [], "events", serviceName),
    faq: byField(breakdowns.faq ?? [], "events", faqName),
    languages: byField(breakdowns.locale ?? [], "visitors", (key) =>
      key === "en" ? "Inglés" : key === "es" ? "Español" : plainName(key),
    ),
  };
}

/** The steps of the contact funnel: the event that marks each one, and how to say it. */
const funnelSteps = /** @type {const} */ ([
  ["contact_view", "Abrieron la página de contacto"],
  ["form_start", "Empezaron el formulario"],
  ["form_submit", "Enviaron el formulario"],
  ["form_success", "El mensaje llegó"],
]);

/**
 * The contact funnel: visitors, then each step as a share of the one before.
 * @param {import("../analytics/query.js").AnalyticsResult} result - The answer of the query API.
 * @returns {BarRow[]} The steps in order, from all the visitors to the messages that arrived.
 */
export function buildFunnel(result) {
  /** @type {Array<{ label: string, value: number, note?: string, cells: string[] }>} */
  const steps = [
    {
      label: "Visitantes",
      value: result.totals.visitors,
      cells: ["Visitantes", formatCount(result.totals.visitors), "—"],
    },
  ];
  for (const [key, label] of funnelSteps) {
    const value = result.events[key]?.visitors ?? 0;
    const before = steps[steps.length - 1].value;
    // The steps are not strictly nested (someone can send the form without the page view that
    // the tracker counted), so the share never goes above 100 %.
    const share = before > 0 ? Math.min(value / before, 1) : null;
    const text = share === null ? "—" : formatPercent(share);
    steps.push({
      label,
      value,
      note: share === null ? undefined : `${text} del paso anterior`,
      cells: [label, formatCount(value), text],
    });
  }
  return toBars(steps, true);
}

/**
 * The other ways of contacting the business, next to the form: clicks to WhatsApp, phone and
 * email, by how many times they were pressed.
 * @param {import("../analytics/query.js").AnalyticsResult} result - The answer of the query API.
 * @returns {BarRow[]} The ways, most used first.
 */
export function buildContactWays(result) {
  /** @type {Array<[string, string]>} */
  const ways = [
    ["whatsapp_click", "Clics en WhatsApp"],
    ["phone_click", "Clics en el teléfono"],
    ["email_click", "Clics en el correo"],
  ];
  return toBars(
    ways.map(([key, label]) => {
      const count = result.events[key]?.events ?? 0;
      return { label, value: count, cells: [label, formatCount(count)] };
    }),
  );
}

/**
 * Where on the page the WhatsApp links were pressed.
 * @param {import("../analytics/query.js").BreakdownEntry[]} entries - The `whatsapp` breakdown.
 * @returns {BarRow[]} The places, most used first.
 */
export function buildWhatsappPlaces(entries) {
  return byField(
    entries,
    "events",
    (key) => whatsappPlaces[key] ?? plainName(key),
  );
}
