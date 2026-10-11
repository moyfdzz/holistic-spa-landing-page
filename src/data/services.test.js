import { describe, expect, it } from "vitest";
import { services } from "./services.js";
import es from "../i18n/es.json";
import en from "../i18n/en.json";

describe("services data", () => {
  it("has an id and an image for every service", () => {
    expect(services.length).toBeGreaterThan(0);
    for (const service of services) {
      expect(service.id.trim()).not.toBe("");
      expect(service.image).toBeTruthy();
    }
  });

  it("has a translated name in both languages for every service", () => {
    for (const service of services) {
      expect(Object.keys(es.services.items)).toContain(service.id);
      expect(Object.keys(en.services.items)).toContain(service.id);
    }
  });
});
