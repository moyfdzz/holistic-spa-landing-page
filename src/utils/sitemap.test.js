import { describe, expect, it } from "vitest";
import { serializeSitemapItem } from "./sitemap.js";

const base = "https://example.com";
const entry = (/** @type {string} */ path) =>
  serializeSitemapItem({ url: `${base}${path}` });
const alternates = (/** @type {string} */ es, /** @type {string} */ en) => [
  { lang: "es", url: `${base}${es}` },
  { lang: "en", url: `${base}${en}` },
  { lang: "x-default", url: `${base}${es}` },
];

describe("serializeSitemapItem", () => {
  it("keeps the slash of the home pages only", () => {
    expect(entry("/").url).toBe(`${base}/`);
    expect(entry("/en").url).toBe(`${base}/en/`);
    expect(entry("/en/").url).toBe(`${base}/en/`);
    expect(entry("/contact/").url).toBe(`${base}/contact`);
    expect(entry("/en/contact/").url).toBe(`${base}/en/contact`);
  });

  it("pairs each page with its other language", () => {
    expect(entry("/").links).toEqual(alternates("/", "/en/"));
    expect(entry("/en/contact").links).toEqual(
      alternates("/contact", "/en/contact"),
    );
  });

  it("pairs pages whose address changes with the language", () => {
    const expected = alternates("/aviso-de-privacidad", "/en/privacy-notice");
    expect(entry("/aviso-de-privacidad").links).toEqual(expected);
    expect(entry("/en/privacy-notice/").links).toEqual(expected);
  });

  it("keeps what the plugin put in the entry", () => {
    const item = { url: `${base}/contact`, priority: 0.8 };
    expect(serializeSitemapItem(item).priority).toBe(0.8);
  });
});
