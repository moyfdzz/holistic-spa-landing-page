// @vitest-environment node
import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import BarList from "./BarList.astro";
import VitalTile from "./VitalTile.astro";

/**
 * @param {unknown} component - The component.
 * @param {Record<string, unknown>} props - Its props.
 * @returns {Promise<string>} The HTML, with each run of white space as one space.
 */
async function render(component, props) {
  const container = await AstroContainer.create();
  const html = await container.renderToString(
    /** @type {Parameters<typeof container.renderToString>[0]} */ (component),
    { props },
  );
  return html.replace(/\s+/g, " ");
}

/** @type {import("../../server/admin/site.js").BarRow[]} */
const rows = [
  {
    label: "Instagram",
    value: 40,
    display: "40",
    share: 1,
    note: "25 % contactaron",
    cells: ["Instagram", "40", "10 (25 %)"],
  },
  {
    label: "Directo",
    value: 10,
    display: "10",
    share: 0.25,
    cells: ["Directo", "10", "0 (0 %)"],
  },
];

const base = {
  id: "sources",
  title: "De dónde llegan",
  rows,
  head: ["Fuente", "Sesiones", "Con contacto"],
};

describe("BarList", () => {
  it("has a heading the section is labelled by", async () => {
    const html = await render(BarList, base);
    expect(html).toMatch(/<section[^>]*aria-labelledby="sources-title"/);
    expect(html).toMatch(
      /<h2[^>]*id="sources-title"[^>]*> ?De dónde llegan ?<\/h2>/,
    );
  });

  it("writes every number as text, so the bars are never the only signal", async () => {
    const html = await render(BarList, base);
    expect(html).toContain("Instagram");
    expect(html).toContain("25 % contactaron");
    // The bar itself is decoration: what it says is in the text beside it.
    expect(html).toMatch(
      /class="[^"]*bars__track[^"]*"[^>]*aria-hidden="true"/,
    );
  });

  it("keeps the note out of the number, so every bar has the same length of track", async () => {
    const html = await render(BarList, base);
    // The note sits on the line of the name; the number column holds only the number.
    expect(html).toMatch(
      /bars__head[^>]*>[\s\S]*25 % contactaron[\s\S]*bars__track/,
    );
    expect(html).toMatch(/bars__value[^>]*> ?40 ?<\/span>/);
  });

  it("sizes each bar against the longest one, and never leaves one invisible", async () => {
    const html = await render(BarList, {
      ...base,
      rows: [
        { ...rows[0], share: 1 },
        { ...rows[1], share: 0.0001 },
      ],
    });
    expect(html).toContain("width: 100%");
    expect(html).toContain("width: 1%");
  });

  it("has the numbers in a table with a row per bar", async () => {
    const html = await render(BarList, base);
    expect(html).toContain("Ver números");
    expect(html.match(/<th[^>]*scope="col"/g)).toHaveLength(3);
    expect(html.match(/<th[^>]*scope="row"/g)).toHaveLength(2);
  });

  it("links the CSV export when it is given one, and only then", async () => {
    const withCsv = await render(BarList, {
      ...base,
      csv: "/api/admin/analytics/export?table=channel&from=2026-10-29&to=2026-11-04",
    });
    expect(withCsv).toMatch(/href="[^"]*table=channel[^"]*"[^>]*download/);
    expect(await render(BarList, base)).not.toContain("Descargar CSV");
  });

  it("says why there is nothing, with no empty table or download", async () => {
    const html = await render(BarList, {
      ...base,
      rows: [],
      csv: "/x",
      empty: "Nadie llegó todavía.",
    });
    expect(html).toContain("Nadie llegó todavía.");
    expect(html).not.toContain("Ver números");
    expect(html).not.toContain("Descargar CSV");
  });
});

describe("VitalTile", () => {
  /** @type {import("../../server/admin/site.js").VitalTile} */
  const tile = {
    id: "lcp",
    name: "LCP",
    what: "Qué tan rápido aparece lo principal de la página",
    value: 2100,
    display: "2.1 s",
    rating: "good",
    limits: "Bueno hasta 2.5 s. Malo desde más de 4 s.",
    samples: 30,
  };

  it("shows the value with its rating in words and with a sign", async () => {
    const html = await render(VitalTile, { tile });
    expect(html).toContain("2.1 s");
    expect(html).toContain("Bueno");
    expect(html).toContain("✓");
    expect(html).toContain("Bueno hasta 2.5 s");
    expect(html).toContain("30 visitas medidas");
  });

  it("uses a different word and sign for each rating", async () => {
    const needs = await render(VitalTile, {
      tile: { ...tile, rating: "needs" },
    });
    expect(needs).toContain("Necesita mejorar");
    expect(needs).toContain("!");
    const poor = await render(VitalTile, { tile: { ...tile, rating: "poor" } });
    expect(poor).toContain("Malo");
    expect(poor).toContain("✕");
  });

  it("says it has no measures yet instead of showing a rating", async () => {
    const html = await render(VitalTile, {
      tile: {
        ...tile,
        value: null,
        display: "Sin datos",
        rating: null,
        samples: 0,
      },
    });
    expect(html).toContain("Sin datos");
    expect(html).toContain("Aún no hay mediciones");
    expect(html).not.toContain("visitas medidas");
  });

  it("warns when there are few measures", async () => {
    const html = await render(VitalTile, { tile: { ...tile, samples: 3 } });
    expect(html).toContain("Son pocas");
    const one = await render(VitalTile, { tile: { ...tile, samples: 1 } });
    expect(one).toContain("1 visita medida");
  });
});
