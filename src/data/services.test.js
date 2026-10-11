import { describe, expect, it } from "vitest";
import { formatDuration, services } from "./services.js";

describe("services data", () => {
  it("has the 8 current services with unique ids and slugs", () => {
    expect(services).toHaveLength(8);
    expect(new Set(services.map((s) => s.id)).size).toBe(services.length);
    expect(new Set(services.map((s) => s.slug)).size).toBe(services.length);
  });

  it("has every required field", () => {
    for (const service of services) {
      expect(service.slug).toMatch(/^[a-z0-9-]+$/);
      expect(service.icon).toMatch(/^[a-z-]+:[a-z0-9-]+$/);
      expect(service.image).toBeTruthy();
      const minutes = [service.durationMin].flat();
      for (const value of minutes) expect(value).toBeGreaterThan(0);
    }
  });

  it("has name, description, benefits and image text in both languages", () => {
    for (const service of services) {
      for (const lang of /** @type {const} */ (["es", "en"])) {
        const text = service.text[lang];
        expect(text.name.trim(), `${service.id}:${lang}:name`).not.toBe("");
        expect(
          text.description.trim(),
          `${service.id}:${lang}:description`,
        ).not.toBe("");
        expect(text.imageAlt.trim(), `${service.id}:${lang}:imageAlt`).not.toBe(
          "",
        );
        expect(text.benefits.length).toBeGreaterThan(0);
      }
    }
  });

  it("gives every photo its own description in each language", () => {
    for (const lang of /** @type {const} */ (["es", "en"])) {
      const alts = services.map((s) => s.text[lang].imageAlt);
      expect(new Set(alts).size).toBe(alts.length);
    }
  });
});

describe("formatDuration", () => {
  it("formats a number and a range", () => {
    expect(formatDuration(60)).toBe("60");
    expect(formatDuration([45, 60])).toBe("45–60");
  });
});
