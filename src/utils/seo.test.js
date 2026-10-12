import { describe, expect, it } from "vitest";
import { site } from "../config/site.js";
import { services } from "../data/services.js";
import {
  absoluteUrl,
  buildLocalBusiness,
  serviceAreaCities,
  trimTrailingSlash,
  toSafeJson,
} from "./seo.js";

describe("absoluteUrl", () => {
  it("joins a path to the site address", () => {
    expect(absoluteUrl("/en/contact", "https://example.com")).toBe(
      "https://example.com/en/contact",
    );
  });
});

describe("trimTrailingSlash", () => {
  it("removes the last slash except on the home page", () => {
    expect(trimTrailingSlash("/contact/")).toBe("/contact");
    expect(trimTrailingSlash("/")).toBe("/");
  });
});

describe("buildLocalBusiness", () => {
  const data = buildLocalBusiness({
    lang: "en",
    site,
    services: services.map((s) => ({
      name: s.text.en.name,
      description: s.text.en.description,
    })),
    description: "Test description",
  });

  it("describes the business with the fields Google asks for", () => {
    expect(data["@type"]).toBe("HealthAndBeautyBusiness");
    expect(data.name).toBe(site.name);
    expect(data.telephone).toBe(site.phone);
    expect(data.foundingDate).toBe("2017");
    expect(data.sameAs).toEqual([
      site.socials.instagram,
      site.socials.facebook,
    ]);
    expect(String(data.logo)).toMatch(/^https:\/\//);
    expect(String(data.image)).toMatch(/^https:\/\//);
  });

  it("lists the opening hours of every day", () => {
    const hours =
      /** @type {{ dayOfWeek: string[], opens: string, closes: string }} */ (
        data.openingHoursSpecification
      );
    expect(hours.dayOfWeek).toHaveLength(7);
    expect(hours.opens).toBe(site.hours.opens);
    expect(hours.closes).toBe(site.hours.closes);
  });

  it("lists the whole metropolitan area and every service", () => {
    const areas = /** @type {{ name: string }[]} */ (data.areaServed);
    expect(areas.map((a) => a.name)).toEqual(serviceAreaCities);
    const catalog = /** @type {{ itemListElement: unknown[] }} */ (
      data.hasOfferCatalog
    );
    expect(catalog.itemListElement).toHaveLength(services.length);
  });

  it("can be written as JSON", () => {
    expect(() => JSON.parse(JSON.stringify(data))).not.toThrow();
  });
});

describe("toSafeJson", () => {
  it("never writes a < character, so a value cannot close the script tag", () => {
    const text = toSafeJson({ name: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
  });

  it("gives back exactly the same data when parsed", () => {
    const data = { a: "x < y", b: ["</b>", 2], c: { d: null } };
    expect(JSON.parse(toSafeJson(data))).toEqual(data);
  });
});
