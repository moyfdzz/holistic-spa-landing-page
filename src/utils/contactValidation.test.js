import { describe, expect, it } from "vitest";
import {
  MESSAGE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  isValidEmail,
  normalizePhone,
  validateContactForm,
} from "./contactValidation.js";

/** @type {import("./contactValidation.js").ContactValues} */
const valid = {
  name: "Ana García",
  email: "ana@example.com",
  phone: "81 8017 1904",
  message: "Hola",
  method: "email",
  consent: true,
};

describe("normalizePhone", () => {
  it("ignores formatting and the +52 prefix", () => {
    expect(normalizePhone("(81) 8017-1904")).toBe("8180171904");
    expect(normalizePhone("+52 81 8017 1904")).toBe("8180171904");
    expect(normalizePhone("528180171904")).toBe("8180171904");
  });

  it("keeps other numbers as they are", () => {
    expect(normalizePhone("12345")).toBe("12345");
    expect(normalizePhone("81abc")).toBe("81abc");
  });
});

describe("isValidEmail", () => {
  it("accepts and rejects", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe.each(["es", "en"])("validateContactForm (%s)", (lang) => {
  const check = (/** @type {Partial<typeof valid>} */ changes) =>
    validateContactForm(
      { ...valid, ...changes },
      /** @type {"es" | "en"} */ (lang),
    );

  it("accepts a complete form", () => {
    expect(check({})).toEqual({ valid: true, errors: {} });
  });

  it("requires a name and limits its length", () => {
    expect(check({ name: "  " }).errors.name).toBeTruthy();
    expect(
      check({ name: "x".repeat(NAME_MAX_LENGTH + 1) }).errors.name,
    ).toBeTruthy();
  });

  it("requires a well formed email when the method is email", () => {
    expect(check({ email: "" }).errors.email).toBeTruthy();
    expect(check({ email: "nope" }).errors.email).toBeTruthy();
  });

  it("does not require the email for WhatsApp or calls, but checks it when filled in", () => {
    expect(
      check({ method: "whatsapp", email: "" }).errors.email,
    ).toBeUndefined();
    expect(check({ method: "phone", email: "nope" }).errors.email).toBeTruthy();
  });

  it("requires a 10 digit phone for WhatsApp and calls", () => {
    for (const method of /** @type {const} */ (["whatsapp", "phone"])) {
      expect(check({ method, phone: "" }).errors.phone).toBeTruthy();
      expect(check({ method, phone: "12345" }).errors.phone).toBeTruthy();
      expect(
        check({ method, phone: "81 80ab 1904" }).errors.phone,
      ).toBeTruthy();
      expect(check({ method, phone: "+52 81 8017 1904" }).valid).toBe(true);
    }
  });

  it("does not require the phone for email, but checks it when filled in", () => {
    expect(check({ phone: "" }).errors.phone).toBeUndefined();
    expect(check({ phone: "123" }).errors.phone).toBeTruthy();
  });

  it("limits the message length", () => {
    expect(
      check({ message: "x".repeat(MESSAGE_MAX_LENGTH + 1) }).errors.message,
    ).toBeTruthy();
    expect(
      check({ message: "x".repeat(MESSAGE_MAX_LENGTH) }).errors.message,
    ).toBeUndefined();
  });

  it("requires the privacy consent", () => {
    expect(check({ consent: false }).errors.consent).toBeTruthy();
  });
});

describe("error messages", () => {
  it("are written in the requested language", () => {
    const es = validateContactForm({ ...valid, name: "" }, "es").errors.name;
    const en = validateContactForm({ ...valid, name: "" }, "en").errors.name;
    expect(es).not.toBe(en);
    expect(en).toMatch(/name/i);
  });
});
