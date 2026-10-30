// @vitest-environment node
import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import GranularityPicker from "./GranularityPicker.astro";
import KpiTile from "./KpiTile.astro";
import VisitsChart from "./VisitsChart.astro";

/**
 * @param {Partial<import("../../server/admin/overview.js").Overview["visits"]>} [visits] - What to change.
 * @returns {import("../../server/admin/overview.js").Overview["visits"]} A visits series of three days.
 */
function series(visits = {}) {
  return {
    buckets: ["2026-11-02", "2026-11-03", "2026-11-04"],
    values: [10, 0, 30],
    previousBuckets: null,
    previousValues: null,
    previousTotal: null,
    granularity: /** @type {const} */ ("day"),
    ...visits,
  };
}

/**
 * @param {unknown} component - The component.
 * @param {Record<string, unknown>} props - Its props.
 * @returns {Promise<string>} The HTML.
 */
async function render(component, props) {
  const container = await AstroContainer.create();
  return container.renderToString(
    /** @type {Parameters<typeof container.renderToString>[0]} */ (component),
    { props },
  );
}

/**
 * @param {string} html - Some HTML.
 * @param {RegExp} pattern - What to count.
 * @returns {number} How many times it appears.
 */
const count = (html, pattern) => (html.match(pattern) ?? []).length;

describe("VisitsChart", () => {
  it("has a text summary the drawings are labelled by, and a title", async () => {
    const html = await render(VisitsChart, { visits: series() });
    expect(html).toContain("Visitas en el tiempo");
    expect(html).toMatch(/Visitantes por día: 40 en total/);
    expect(html).toMatch(
      /<svg[^>]*role="img"[^>]*aria-labelledby="visits-summary"/,
    );
    expect(html).toContain('id="visits-summary"');
  });

  it("draws one version for a phone and one for a wide screen", async () => {
    const html = await render(VisitsChart, { visits: series() });
    expect(count(html, /chart__svg--narrow/g)).toBeGreaterThanOrEqual(1);
    expect(count(html, /chart__svg--wide/g)).toBeGreaterThanOrEqual(1);
    expect(html).toContain('viewBox="0 0 360 250"');
    expect(html).toContain('viewBox="0 0 720 290"');
  });

  it("lists the data in a table with a row per bucket", async () => {
    const html = await render(VisitsChart, { visits: series() });
    expect(html).toContain("Ver números");
    expect(count(html, /<tbody[^>]*>/g)).toBe(1);
    expect(count(html, /<th[^>]*scope="row"/g)).toBe(3);
    expect(html).not.toContain("Periodo anterior");
  });

  it("adds a legend entry, a dashed line and a table column for the previous period", async () => {
    const html = await render(VisitsChart, {
      visits: series({
        previousBuckets: ["2026-10-30", "2026-10-31", "2026-11-01"],
        previousValues: [5, 5, 5],
        previousTotal: 15,
      }),
    });
    expect(html).toContain("Periodo elegido");
    expect(html).toContain("Periodo anterior");
    expect(html).toContain("chart__before");
    expect(html).toContain("En el periodo anterior fueron 15.");
    expect(html).toMatch(/<th[^>]*scope="col"[^>]*>Periodo anterior<\/th>/);
    expect(html).toContain("5 (30 oct)");
  });

  it("has a legend with one entry and no dashed line when it is not compared", async () => {
    const html = await render(VisitsChart, { visits: series() });
    expect(html).not.toMatch(/<path[^>]*class="[^"]*chart__before/);
    expect(count(html, /chart__key chart/g)).toBe(1);
  });

  it("can be reached with the keyboard and tells how to use it", async () => {
    const html = await render(VisitsChart, { visits: series() });
    expect(html).toMatch(/data-visits-chart[^>]*tabindex="0"/);
    expect(html).toContain("flechas del teclado");
    expect(html).toContain('aria-live="polite"');
  });

  it("starts with a hint instead of a tooltip over the data", async () => {
    const html = await render(VisitsChart, { visits: series() });
    expect(html).toContain("Pasa el cursor o toca la gráfica");
  });

  it("does not break and is not focusable when there are no buckets", async () => {
    const html = await render(VisitsChart, {
      visits: series({ buckets: [], values: [] }),
    });
    expect(html).toContain("sin datos en este periodo");
    expect(html).not.toMatch(/data-visits-chart[^>]*tabindex/);
  });

  it("shows the weeks by the name of their first day", async () => {
    const html = await render(VisitsChart, {
      visits: series({
        buckets: ["2026-10-26", "2026-11-02"],
        values: [4, 6],
        granularity: "week",
      }),
    });
    expect(html).toContain("Semana del 26 oct");
    expect(html).toContain("por semana");
  });
});

describe("GranularityPicker", () => {
  it("keeps the range of the address and marks the current grouping", async () => {
    const html = await render(GranularityPicker, {
      current: "week",
      action: "/admin",
      query: new URLSearchParams("range=custom&from=2026-10-29&to=2026-11-04"),
    });
    expect(html).toContain("range=custom");
    expect(html).toContain("from=2026-10-29");
    expect(html).toContain("g=month");
    expect(html).toMatch(/href="[^"]*g=week"[^>]*aria-current="true"/);
    expect(count(html, /aria-current/g)).toBe(1);
  });
});

describe("KpiTile", () => {
  it("shows the text it is given instead of the number", async () => {
    const html = await render(KpiTile, {
      label: "Tiempo activo",
      value: 74,
      display: "1 min 14 s",
    });
    expect(html).toContain("1 min 14 s");
    expect(html).not.toContain(">74<");
  });

  it("says in text whether it went up or down, not only with an arrow", async () => {
    const up = await render(KpiTile, {
      label: "Visitantes",
      value: 120,
      previous: 100,
    });
    expect(up).toContain("Sube 20 % frente al periodo anterior");
    const down = await render(KpiTile, {
      label: "Visitantes",
      value: 80,
      previous: 100,
    });
    expect(down).toContain("Baja 20 % frente al periodo anterior");
  });
});
