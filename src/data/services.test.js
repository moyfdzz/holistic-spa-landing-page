import { describe, expect, it } from "vitest";
import { services } from "./services.js";

describe("services data", () => {
  it("has a name and an image for every service", () => {
    expect(services.length).toBeGreaterThan(0);
    for (const service of services) {
      expect(service.name.trim()).not.toBe("");
      expect(service.image).toBeTruthy();
    }
  });
});
