import { describe, expect, it } from "vitest";
import { getDurationsBySlug, services } from "./services.js";

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
      expect(service.durations.length).toBeGreaterThan(0);
      for (const value of service.durations) expect(value).toBeGreaterThan(0);
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

describe("service durations", () => {
  it("offers 60, 90 and 120 minutes for every massage", () => {
    for (const service of services.filter((s) => !s.id.endsWith("Facial"))) {
      expect(service.durations, service.id).toEqual([60, 90, 120]);
    }
  });

  it("offers only 60 minutes for every facial", () => {
    const facials = services.filter((s) => s.id.endsWith("Facial"));
    expect(facials).toHaveLength(2);
    for (const service of facials) expect(service.durations).toEqual([60]);
  });
});

describe("getDurationsBySlug", () => {
  it("returns the lengths of a service and an empty list for unknown slugs", () => {
    expect(getDurationsBySlug("shiatsu")).toEqual([60, 90, 120]);
    expect(getDurationsBySlug("nope")).toEqual([]);
  });
});
