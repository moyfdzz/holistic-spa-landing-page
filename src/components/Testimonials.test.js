// @vitest-environment node
import { describe, expect, it } from "vitest";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import Testimonials from "./Testimonials.astro";

/** @type {import("../data/testimonials.js").Testimonial[]} */
const items = [
  {
    id: "a",
    author: "Ana G.",
    rating: 5,
    serviceSlug: "shiatsu",
    date: "2026-09-01",
    originalLang: "es",
    quote: {
      es: "Excelente servicio, muy relajante.",
      en: "Excellent service, very relaxing.",
    },
    consent: true,
  },
  {
    id: "b",
    author: "Luis M.",
    rating: 4,
    date: "2026-08-01",
    originalLang: "en",
    quote: { es: "Muy puntuales.", en: "Very punctual." },
    consent: false,
  },
];

/**
 * Renders the section for a page address.
 * @param {string} path - Page path, for example `/en/`.
 * @param {typeof items} list - The testimonials to give the component.
 * @returns {Promise<string>} The HTML.
 */
async function render(path, list) {
  const container = await AstroContainer.create();
  return container.renderToString(Testimonials, {
    props: { items: list },
    request: new Request(`http://localhost${path}`),
  });
}

describe("Testimonials", () => {
  it("renders nothing when there are no testimonials", async () => {
    expect((await render("/", [])).trim()).toBe("");
  });

  it("shows only testimonials with consent, with an accessible rating", async () => {
    const html = await render("/", items);
    expect(html).toContain("Ana G.");
    expect(html).toContain("Excelente servicio");
    expect(html).toContain('aria-label="5 de 5 estrellas"');
    expect(html).not.toContain("Luis M.");
  });

  it("shows the translation and the service name on the English page", async () => {
    const html = await render("/en/", items);
    expect(html).toContain("Excellent service, very relaxing.");
    expect(html).toContain('aria-label="5 out of 5 stars"');
    expect(html).toContain("Shiatsu");
    expect(html).toContain("September 2026");
  });
});
