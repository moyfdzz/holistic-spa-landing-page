import { describe, expect, it } from "vitest";
import { isAdminEmail, parseAdminEmails } from "./allowlist.js";

describe("parseAdminEmails", () => {
  it("cleans, lowercases and removes repeats", () => {
    expect(
      parseAdminEmails(
        " Dueno@Example.com , dueno@example.com,otra@example.com ",
      ),
    ).toEqual(["dueno@example.com", "otra@example.com"]);
  });

  it("returns nothing for an empty or broken value", () => {
    expect(parseAdminEmails(undefined)).toEqual([]);
    expect(parseAdminEmails("")).toEqual([]);
    expect(parseAdminEmails("sin-arroba, ,")).toEqual([]);
  });
});

describe("isAdminEmail", () => {
  const allowed = parseAdminEmails("dueno@example.com");

  it("accepts an email in the list, whatever its case", () => {
    expect(isAdminEmail(allowed, "Dueno@Example.com")).toBe(true);
  });

  it("refuses everything else, including an empty list and a missing email", () => {
    expect(isAdminEmail(allowed, "intruso@example.com")).toBe(false);
    expect(isAdminEmail(allowed, null)).toBe(false);
    expect(isAdminEmail([], "dueno@example.com")).toBe(false);
  });

  it("does not accept a look-alike address", () => {
    expect(isAdminEmail(allowed, "dueno@example.com.evil.test")).toBe(false);
    expect(isAdminEmail(allowed, "xdueno@example.com")).toBe(false);
  });
});
