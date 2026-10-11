import { beforeEach, describe, expect, it } from "vitest";
import { preselectService } from "./contact-service.js";

describe("preselectService", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <select data-service-select>
        <option value="">Choose</option>
        <option value="shiatsu">Shiatsu</option>
        <option value="prenatal">Prenatal</option>
      </select>`;
  });

  /** @returns {string} The selected value. */
  const value = () =>
    /** @type {HTMLSelectElement} */ (
      document.querySelector("[data-service-select]")
    ).value;

  it("selects the service named in the address", () => {
    expect(preselectService(document, "?service=prenatal")).toBe(true);
    expect(value()).toBe("prenatal");
  });

  it("ignores unknown or missing services", () => {
    expect(preselectService(document, "?service=unknown")).toBe(false);
    expect(preselectService(document, "")).toBe(false);
    expect(value()).toBe("");
  });

  it("does nothing when the page has no service select", () => {
    document.body.innerHTML = "<p>No form</p>";
    expect(preselectService(document, "?service=shiatsu")).toBe(false);
  });
});
