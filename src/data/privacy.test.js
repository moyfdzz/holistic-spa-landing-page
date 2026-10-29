import { describe, expect, it } from "vitest";
import { privacy, privacyUpdated } from "./privacy.js";

describe("privacy notice", () => {
  it("has a valid last-updated date", () => {
    expect(privacyUpdated).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(privacyUpdated))).toBe(false);
  });

  it("has the same sections in Spanish and English", () => {
    expect(privacy.en.sections.map((s) => s.id)).toEqual(
      privacy.es.sections.map((s) => s.id),
    );
  });

  it("has no empty headings or paragraphs", () => {
    for (const lang of /** @type {const} */ (["es", "en"])) {
      expect(privacy[lang].title.trim()).not.toBe("");
      expect(privacy[lang].intro.trim()).not.toBe("");
      for (const section of privacy[lang].sections) {
        expect(section.heading.trim(), `${lang}:${section.id}`).not.toBe("");
        for (const text of [...section.paragraphs, ...(section.items ?? [])]) {
          expect(text.trim(), `${lang}:${section.id}`).not.toBe("");
        }
      }
    }
  });

  it("covers who is responsible, purposes, providers and ARCO rights", () => {
    const all = JSON.stringify(privacy.es);
    for (const word of [
      "Responsable",
      "finalidades",
      "Web3Forms",
      "Cloudflare",
      "Neon",
      "ARCO",
    ]) {
      expect(all.toLowerCase()).toContain(word.toLowerCase());
    }
  });

  it("describes the anonymous statistics in both languages without promising more than they do", () => {
    for (const lang of /** @type {const} */ (["es", "en"])) {
      const section = privacy[lang].sections.find(
        (s) => s.id === "estadisticas",
      );
      expect(section, lang).toBeDefined();
      const text = JSON.stringify(section).toLowerCase();
      expect(text).toContain("13");
      expect(text).toMatch(/do not track|no rastrear/);
      expect(text).toMatch(/ip/);
    }
  });

  it("does not publish an email address or personal name", () => {
    expect(JSON.stringify(privacy)).not.toMatch(/@/);
  });
});
