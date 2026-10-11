import { afterEach, describe, expect, it, vi } from "vitest";
import es from "./es.json";
import en from "./en.json";
import {
  flattenKeys,
  getLangFromUrl,
  getLocalizedPath,
  stripLangPrefix,
  useTranslations,
} from "./utils.js";

describe("getLangFromUrl", () => {
  it("returns en for English pages", () => {
    expect(getLangFromUrl(new URL("https://x.test/en/"))).toBe("en");
    expect(getLangFromUrl(new URL("https://x.test/en/contact"))).toBe("en");
    expect(getLangFromUrl("/en")).toBe("en");
  });

  it("returns es for everything else", () => {
    expect(getLangFromUrl(new URL("https://x.test/"))).toBe("es");
    expect(getLangFromUrl("/contact")).toBe("es");
    expect(getLangFromUrl("/english-lessons")).toBe("es");
  });
});

describe("getLocalizedPath", () => {
  it("adds the /en prefix for English", () => {
    expect(getLocalizedPath("/", "en")).toBe("/en/");
    expect(getLocalizedPath("/contact", "en")).toBe("/en/contact");
    expect(getLocalizedPath("/#about", "en")).toBe("/en/#about");
  });

  it("leaves Spanish paths without a prefix", () => {
    expect(getLocalizedPath("/contact", "es")).toBe("/contact");
    expect(getLocalizedPath("/en/contact", "es")).toBe("/contact");
    expect(getLocalizedPath("/en/", "es")).toBe("/");
  });

  it("does not double the prefix", () => {
    expect(getLocalizedPath("/en/contact", "en")).toBe("/en/contact");
  });
});

describe("stripLangPrefix", () => {
  it("removes only a real /en prefix", () => {
    expect(stripLangPrefix("/en")).toBe("/");
    expect(stripLangPrefix("/en/contact")).toBe("/contact");
    expect(stripLangPrefix("/entrance")).toBe("/entrance");
  });
});

describe("useTranslations", () => {
  afterEach(() => vi.restoreAllMocks());

  it("translates a key in each language", () => {
    expect(useTranslations("es")("nav.home")).toBe("Inicio");
    expect(useTranslations("en")("nav.home")).toBe("Home");
  });

  it("fills in values", () => {
    expect(useTranslations("en")("home.ctaTitle", { name: "Acme" })).toContain(
      "Acme",
    );
  });

  it("returns the key and warns when a text is missing everywhere", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(useTranslations("en")("nope.missing")).toBe("nope.missing");
    expect(warn).toHaveBeenCalled();
  });
});

describe("translation files", () => {
  it("have exactly the same keys in Spanish and English", () => {
    expect(flattenKeys(en)).toEqual(flattenKeys(es));
  });

  it("have no empty texts", () => {
    for (const lang of /** @type {const} */ (["es", "en"])) {
      const t = useTranslations(lang);
      for (const key of flattenKeys(lang === "es" ? es : en)) {
        expect(t(key).trim(), `${lang}:${key}`).not.toBe("");
        expect(t(key), `${lang}:${key}`).not.toBe(key);
      }
    }
  });
});
