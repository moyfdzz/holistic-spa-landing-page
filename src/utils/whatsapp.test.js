import { describe, expect, it } from "vitest";
import { buildWhatsAppUrl } from "./whatsapp.js";

describe("buildWhatsAppUrl", () => {
  it("keeps only the digits of the phone number", () => {
    expect(buildWhatsAppUrl("+52 81 8017 1904")).toBe(
      "https://wa.me/528180171904",
    );
  });

  it("adds an encoded message", () => {
    const url = buildWhatsAppUrl("+528180171904", "Hola, ¿cuánto cuesta?");
    expect(url).toBe(
      "https://wa.me/528180171904?text=Hola%2C%20%C2%BFcu%C3%A1nto%20cuesta%3F",
    );
  });

  it("rejects numbers that are too short", () => {
    expect(() => buildWhatsAppUrl("123")).toThrow(TypeError);
    expect(() => buildWhatsAppUrl("")).toThrow(TypeError);
  });
});
