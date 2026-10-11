import { describe, expect, it } from "vitest";
import { services } from "./services.js";
import {
  getPublishedTestimonials,
  testimonials,
  validateTestimonial,
} from "./testimonials.js";

/** @type {import("./testimonials.js").Testimonial} */
const sample = {
  id: "sample",
  author: "Ana G.",
  rating: 5,
  date: "2026-09-01",
  originalLang: "es",
  quote: { es: "Excelente servicio.", en: "Excellent service." },
  consent: true,
};

describe("getPublishedTestimonials", () => {
  it("hides testimonials without consent and sorts the rest, newest first", () => {
    const list = [
      { ...sample, id: "old", date: "2026-01-01" },
      { ...sample, id: "no-consent", consent: false },
      { ...sample, id: "new", date: "2026-09-30" },
    ];
    expect(getPublishedTestimonials(list).map((t) => t.id)).toEqual([
      "new",
      "old",
    ]);
  });
});

describe("validateTestimonial", () => {
  it("accepts a complete testimonial", () => {
    expect(validateTestimonial(sample)).toEqual([]);
  });

  it("asks for first name and initial only", () => {
    expect(
      validateTestimonial({ ...sample, author: "Ana García López" }),
    ).not.toEqual([]);
    expect(validateTestimonial({ ...sample, author: "ana" })).not.toEqual([]);
  });

  it("checks the rating, the date, both texts and the consent", () => {
    expect(validateTestimonial({ ...sample, rating: 6 })).not.toEqual([]);
    expect(validateTestimonial({ ...sample, rating: 4.5 })).not.toEqual([]);
    expect(validateTestimonial({ ...sample, date: "1 Sep" })).not.toEqual([]);
    expect(
      validateTestimonial({ ...sample, quote: { es: "Hola", en: " " } }),
    ).not.toEqual([]);
    expect(validateTestimonial({ ...sample, consent: false })).not.toEqual([]);
  });
});

describe("the real testimonials list", () => {
  it("only contains valid testimonials with consent", () => {
    for (const item of testimonials) {
      expect(validateTestimonial(item), item.id).toEqual([]);
      if (item.serviceSlug) {
        expect(services.map((s) => s.slug)).toContain(item.serviceSlug);
      }
    }
  });
});
