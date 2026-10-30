import { describe, expect, it } from "vitest";
import { faq } from "../../data/faq.js";
import { services } from "../../data/services.js";
import {
  buildContactWays,
  buildEngagement,
  buildFunnel,
  buildScroll,
  buildSite,
  buildSources,
  buildVitals,
  buildWhatsappPlaces,
  faqName,
  outsideShare,
  pageName,
  rateVital,
  serviceName,
} from "./site.js";

/**
 * @param {string} key - The key.
 * @param {Partial<import("../analytics/query.js").BreakdownEntry>} [counts] - What to set.
 * @returns {import("../analytics/query.js").BreakdownEntry} A breakdown row.
 */
const entry = (key, counts = {}) => ({
  key,
  visitors: 0,
  sessions: 0,
  pageViews: 0,
  events: 0,
  engagedSeconds: 0,
  bounces: 0,
  bounceRate: 0,
  avgEngagedSeconds: 0,
  ...counts,
});

/**
 * Normal spaces for the tests: the page writes number and unit with a no-break space.
 * @param {string} text - The text.
 * @returns {string} The text with normal spaces.
 */
const plain = (text) => text.replaceAll("\u00a0", " ");

/**
 * @param {Record<string, import("../analytics/query.js").BreakdownEntry[]>} breakdowns - The breakdowns.
 * @param {Partial<import("../analytics/query.js").AnalyticsResult>} [extra] - What to change.
 * @returns {import("../analytics/query.js").AnalyticsResult} A small answer of the query API.
 */
function result(breakdowns, extra = {}) {
  return /** @type {import("../analytics/query.js").AnalyticsResult} */ ({
    totals: { ...entry("total"), events: 10, visitors: 5 },
    distributions: {},
    events: {},
    breakdowns,
    series: [],
    comparison: null,
    ...extra,
  });
}

describe("buildSources", () => {
  it("lists the channels by sessions with the share of them that contacted", () => {
    const rows = buildSources(
      result({
        channel: [
          entry("direct", { sessions: 10 }),
          entry("instagram", { sessions: 40 }),
          entry("google_maps", { sessions: 20 }),
        ],
        contacted_channel: [
          entry("instagram", { sessions: 10 }),
          entry("google_maps", { sessions: 1 }),
        ],
      }),
    );
    expect(rows.map((row) => row.label)).toEqual([
      "Instagram",
      "Google Maps",
      "Directo",
    ]);
    expect(rows[0].value).toBe(40);
    expect(plain(rows[0].note ?? "")).toBe("25 % contactaron");
    expect(plain(rows[1].note ?? "")).toBe("5 % contactaron");
    expect(plain(rows[2].note ?? "")).toBe("0 % contactaron");
    expect(rows[0].share).toBe(1);
    expect(rows[1].share).toBe(0.5);
    expect(rows[0].cells.map(plain)).toEqual(["Instagram", "40", "10 (25 %)"]);
  });

  it("leaves out the channels with no sessions, like the visits that move inside the site", () => {
    const rows = buildSources(
      result({
        channel: [
          entry("internal", { sessions: 0, visitors: 8 }),
          entry("direct", { sessions: 3 }),
        ],
      }),
    );
    expect(rows.map((row) => row.label)).toEqual(["Directo"]);
  });

  it("never gives a conversion above 100 %", () => {
    const rows = buildSources(
      result({
        channel: [entry("direct", { sessions: 2 })],
        contacted_channel: [entry("direct", { sessions: 5 })],
      }),
    );
    expect(plain(rows[0].note ?? "")).toBe("100 % contactaron");
  });

  it("names a channel it does not know and has no rows when there is nothing", () => {
    expect(buildSources(result({}))).toEqual([]);
    expect(
      buildSources(
        result({ channel: [entry("(unknown)", { sessions: 1 })] }),
      )[0].label,
    ).toBe("Sin datos");
  });
});

describe("outsideShare", () => {
  it("is the share of the known visitors who are outside the home state", () => {
    const share = outsideShare([
      entry("Nuevo León", { visitors: 75 }),
      entry("Jalisco", { visitors: 15 }),
      entry("Texas", { visitors: 10 }),
      entry("(unknown)", { visitors: 500 }),
    ]);
    expect(share).toEqual({ known: 100, outside: 25, share: 0.25 });
  });

  it("is null when no state is known", () => {
    expect(outsideShare([])).toBeNull();
    expect(outsideShare([entry("(unknown)", { visitors: 4 })])).toBeNull();
  });

  it("is 100 % when nobody is from the home state", () => {
    expect(outsideShare([entry("Jalisco", { visitors: 3 })])?.share).toBe(1);
  });
});

describe("rateVital", () => {
  it("rates by the limits of good and poor of each measure", () => {
    expect(rateVital("lcp", 2500)).toBe("good");
    expect(rateVital("lcp", 2501)).toBe("needs");
    expect(rateVital("lcp", 4000)).toBe("needs");
    expect(rateVital("lcp", 4001)).toBe("poor");
    expect(rateVital("inp", 200)).toBe("good");
    expect(rateVital("inp", 501)).toBe("poor");
    expect(rateVital("cls", 0.1)).toBe("good");
    expect(rateVital("cls", 0.26)).toBe("poor");
    expect(rateVital("ttfb", 800)).toBe("good");
    expect(rateVital("fcp", 3001)).toBe("poor");
  });
});

describe("buildVitals", () => {
  it("makes a tile of each measure, with the p75 written and rated", () => {
    const tiles = buildVitals({
      lcp: { samples: 30, p50: 1500, p75: 2100 },
      cls: { samples: 12, p50: 0.02, p75: 0.18 },
    });
    expect(tiles.map((tile) => tile.id)).toEqual([
      "lcp",
      "inp",
      "cls",
      "fcp",
      "ttfb",
    ]);
    const [lcp, inp, cls] = tiles;
    expect(plain(lcp.display)).toBe("2.1 s");
    expect(lcp.rating).toBe("good");
    expect(lcp.samples).toBe(30);
    expect(cls.display).toBe("0.18");
    expect(cls.rating).toBe("needs");
    expect(plain(lcp.limits)).toBe("Bueno hasta 2.5 s. Malo desde más de 4 s.");
    expect(inp).toMatchObject({
      value: null,
      display: "Sin datos",
      rating: null,
      samples: 0,
    });
  });
});

describe("buildSite", () => {
  it("builds the blocks from the answer", () => {
    const site = buildSite(
      result(
        {
          channel: [entry("direct", { sessions: 4 })],
          device: [
            entry("mobile", { visitors: 7 }),
            entry("desktop", { visitors: 3 }),
          ],
          browser: [
            entry("Chrome", { visitors: 6 }),
            entry("Safari", { visitors: 4 }),
          ],
          region: [
            entry("Nuevo León", { visitors: 9 }),
            entry("Jalisco", { visitors: 1 }),
          ],
          city: [
            entry("Monterrey", { visitors: 8 }),
            entry("(unknown)", { visitors: 2 }),
          ],
        },
        { distributions: { lcp: { samples: 3, p50: 1000, p75: 1200 } } },
      ),
    );
    expect(site.empty).toBe(false);
    expect(site.devices.map((row) => row.label)).toEqual([
      "Teléfono",
      "Computadora",
    ]);
    expect(site.browsers.map((row) => row.label)).toEqual(["Chrome", "Safari"]);
    expect(site.states.map((row) => row.label)).toEqual([
      "Nuevo León",
      "Jalisco",
    ]);
    expect(site.cities.map((row) => row.label)).toEqual([
      "Monterrey",
      "Sin datos",
    ]);
    expect(site.outside?.share).toBeCloseTo(0.1);
    expect(site.vitals[0].rating).toBe("good");
  });

  it("is empty when there are no events", () => {
    const site = buildSite(
      result({}, { totals: { ...entry("total"), events: 0 } }),
    );
    expect(site.empty).toBe(true);
    expect(site.sources).toEqual([]);
    expect(site.outside).toBeNull();
  });
});

describe("names", () => {
  it("names the pages of the site and leaves any other path as it is", () => {
    expect(pageName("/")).toBe("Inicio");
    expect(pageName("/en/contact")).toBe("Contacto (en inglés)");
    expect(pageName("/aviso-de-privacidad")).toBe("Aviso de privacidad");
    expect(pageName("/wp-login.php")).toBe("/wp-login.php");
  });

  it("names a service by the slug the tracker sends, with the data of the site", () => {
    for (const service of services) {
      expect(serviceName(service.slug)).toBe(service.text.es.name);
    }
    expect(serviceName("no-existe")).toBe("no-existe");
  });

  it("names a question of the FAQ by its id", () => {
    for (const item of faq) {
      expect(faqName(item.id)).toBe(item.text.es.question);
    }
    expect(faqName("no-existe")).toBe("no-existe");
  });
});

describe("buildScroll", () => {
  it("gives the five depths in order, with the share of the page views of each", () => {
    const rows = buildScroll([
      entry("100", { events: 50 }),
      entry("0", { events: 30 }),
      entry("50", { events: 20 }),
    ]);
    expect(rows.map((row) => row.label)).toEqual([
      "Casi no bajaron",
      "Hasta un cuarto de la página",
      "Hasta la mitad",
      "Hasta tres cuartos",
      "Llegaron hasta el final",
    ]);
    expect(rows.map((row) => row.value)).toEqual([30, 0, 20, 0, 50]);
    expect(plain(rows[4].note ?? "")).toBe("50 %");
    expect(rows[4].share).toBe(1);
    expect(rows[1].share).toBe(0);
  });

  it("has nothing when no page view was measured", () => {
    expect(buildScroll([])).toEqual([]);
  });
});

describe("buildFunnel", () => {
  /**
   * @param {Record<string, number>} visitors - Visitors of each kind of event.
   * @param {number} [total] - Visitors of the range.
   * @returns {import("../analytics/query.js").AnalyticsResult} A small answer of the query API.
   */
  const withEvents = (visitors, total = 100) =>
    result(
      {},
      {
        totals: { ...entry("total"), events: 10, visitors: total },
        events: Object.fromEntries(
          Object.entries(visitors).map(([key, count]) => [
            key,
            { events: count, visitors: count },
          ]),
        ),
      },
    );

  it("goes from all the visitors to the messages that arrived, with the share of each step", () => {
    const rows = buildFunnel(
      withEvents({
        contact_view: 40,
        form_start: 20,
        form_submit: 10,
        form_success: 8,
      }),
    );
    expect(rows.map((row) => row.label)).toEqual([
      "Visitantes",
      "Abrieron la página de contacto",
      "Empezaron el formulario",
      "Enviaron el formulario",
      "El mensaje llegó",
    ]);
    expect(rows.map((row) => row.value)).toEqual([100, 40, 20, 10, 8]);
    expect(rows[0].note).toBeUndefined();
    expect(plain(rows[1].note ?? "")).toBe("40 % del paso anterior");
    expect(plain(rows[2].note ?? "")).toBe("50 % del paso anterior");
    expect(plain(rows[4].note ?? "")).toBe("80 % del paso anterior");
    expect(rows[1].share).toBe(0.4);
  });

  it("keeps the steps that nobody reached, so the funnel shows where it stops", () => {
    const rows = buildFunnel(withEvents({ contact_view: 10 }));
    expect(rows.map((row) => row.value)).toEqual([100, 10, 0, 0, 0]);
    expect(plain(rows[2].note ?? "")).toBe("0 % del paso anterior");
    // After a step nobody reached there is nothing to divide by.
    expect(rows[3].note).toBeUndefined();
    expect(rows[3].cells.map(plain)).toEqual([
      "Enviaron el formulario",
      "0",
      "—",
    ]);
  });

  it("never goes above 100 % when the steps are not nested", () => {
    const rows = buildFunnel(withEvents({ contact_view: 5, form_start: 9 }));
    expect(plain(rows[2].note ?? "")).toBe("100 % del paso anterior");
  });

  it("has a table with the visitors of each step and its share", () => {
    const rows = buildFunnel(withEvents({ contact_view: 25 }));
    expect(rows[1].cells.map(plain)).toEqual([
      "Abrieron la página de contacto",
      "25",
      "25 %",
    ]);
  });
});

describe("contact ways", () => {
  it("counts the clicks to WhatsApp, phone and email, most used first", () => {
    const rows = buildContactWays(
      result(
        {},
        {
          events: {
            whatsapp_click: { events: 30, visitors: 20 },
            phone_click: { events: 4, visitors: 4 },
            email_click: { events: 9, visitors: 7 },
          },
        },
      ),
    );
    expect(rows.map((row) => [row.label, row.value])).toEqual([
      ["Clics en WhatsApp", 30],
      ["Clics en el correo", 9],
      ["Clics en el teléfono", 4],
    ]);
  });

  it("names the places of the WhatsApp links, the floating button apart from the rest", () => {
    const rows = buildWhatsappPlaces([
      entry("floating", { events: 12 }),
      entry("hero", { events: 5 }),
      entry("service_card", { events: 8 }),
      entry("somewhere-new", { events: 1 }),
    ]);
    expect(rows.map((row) => row.label)).toEqual([
      "Botón flotante",
      "Tarjeta de servicio",
      "Portada",
      "somewhere-new",
    ]);
  });
});

describe("buildEngagement", () => {
  const breakdowns = {
    path: [
      entry("/", { pageViews: 300, sessions: 120 }),
      entry("/contact", { pageViews: 80, sessions: 5 }),
      entry("/en/", { pageViews: 40, sessions: 40 }),
    ],
    service: [
      entry("relajante", { events: 50 }),
      entry("shiatsu", { events: 12 }),
    ],
    faq: [entry("booking", { events: 9 })],
    locale: [entry("es", { visitors: 90 }), entry("en", { visitors: 10 })],
  };
  const totals = {
    ...entry("total"),
    events: 100,
    visitors: 80,
    sessions: 100,
    pageViews: 250,
    avgEngagedSeconds: 65,
    bounceRate: 0.321,
  };

  it("makes the four tiles of what the visitors do", () => {
    const { tiles } = buildEngagement(
      result(breakdowns, {
        totals,
        distributions: { engaged_seconds: { samples: 40, p50: 38, p75: 80 } },
      }),
    );
    const byId = Object.fromEntries(tiles.map((tile) => [tile.id, tile]));
    expect(plain(byId.engaged.display)).toBe("1 min 5 s");
    expect(plain(byId.median.display)).toBe("38 s");
    expect(plain(byId.bounce.display)).toBe("32.1 %");
    expect(byId.pages.display).toBe("2.5");
  });

  it("says there is no median when nobody measured it, and does not divide by zero", () => {
    const { tiles } = buildEngagement(
      result({}, { totals: { ...totals, sessions: 0, pageViews: 0 } }),
    );
    const byId = Object.fromEntries(tiles.map((tile) => [tile.id, tile]));
    expect(byId.median.display).toBe("Sin datos");
    expect(byId.pages.display).toBe("0");
  });

  it("ranks the pages by views and the landing pages by sessions", () => {
    const { pages, landing } = buildEngagement(result(breakdowns, { totals }));
    expect(pages.map((row) => [row.label, row.value])).toEqual([
      ["Inicio", 300],
      ["Contacto", 80],
      ["Inicio (en inglés)", 40],
    ]);
    expect(landing.map((row) => [row.label, row.value])).toEqual([
      ["Inicio", 120],
      ["Inicio (en inglés)", 40],
      ["Contacto", 5],
    ]);
  });

  it("names the services, the questions and the languages", () => {
    const engagement = buildEngagement(result(breakdowns, { totals }));
    expect(engagement.services.map((row) => row.label)).toEqual([
      serviceName("relajante"),
      serviceName("shiatsu"),
    ]);
    expect(engagement.faq[0].label).toBe(faqName("booking"));
    expect(engagement.languages.map((row) => row.label)).toEqual([
      "Español",
      "Inglés",
    ]);
  });
});
