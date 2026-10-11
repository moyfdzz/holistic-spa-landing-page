import { describe, expect, it } from "vitest";
import { site } from "./site.js";

describe("site config", () => {
  it("has the new business name and nothing from the old brand", () => {
    expect(site.name).toBe("Masajes Relax Monterrey");
    expect(JSON.stringify(site)).not.toMatch(/hol.stic/i);
  });

  it("has text for every required field", () => {
    const texts = [
      site.name,
      site.shortName,
      site.area,
      site.city,
      site.region,
    ];
    for (const text of texts) {
      expect(text.trim()).not.toBe("");
    }
    expect(site.tagline.es.trim()).not.toBe("");
    expect(site.tagline.en.trim()).not.toBe("");
  });

  it("writes phone numbers in international format", () => {
    expect(site.phone).toMatch(/^\+\d[\d ]{8,}$/);
    expect(site.whatsapp).toMatch(/^\+\d[\d ]{8,}$/);
  });

  it("has a founding year that is a whole number in the past", () => {
    expect(Number.isInteger(site.foundedYear)).toBe(true);
    expect(site.foundedYear).toBe(2017);
    expect(site.foundedYear).toBeLessThanOrEqual(new Date().getFullYear());
  });

  it("has secure social and site addresses", () => {
    for (const link of [site.socials.instagram, site.socials.facebook]) {
      expect(new URL(link).protocol).toBe("https:");
    }
    expect(new URL(site.url).protocol).toBe("https:");
    expect(site.url.endsWith("/")).toBe(false);
  });
});
