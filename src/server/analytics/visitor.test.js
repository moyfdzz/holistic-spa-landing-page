import { describe, expect, it } from "vitest";
import { dayKey, hashVisitor, newSalt } from "./visitor.js";

const base = {
  salt: "salt-of-monday",
  ip: "203.0.113.7",
  userAgent: "Mozilla/5.0",
  siteHost: "www.example.com",
};

describe("hashVisitor", () => {
  it("is stable for the same browser on the same day", async () => {
    expect(await hashVisitor(base)).toBe(await hashVisitor(base));
  });

  it("changes when the salt changes, so days cannot be linked", async () => {
    expect(await hashVisitor(base)).not.toBe(
      await hashVisitor({ ...base, salt: "salt-of-tuesday" }),
    );
  });

  it("tells two browsers apart", async () => {
    expect(await hashVisitor(base)).not.toBe(
      await hashVisitor({ ...base, ip: "203.0.113.8" }),
    );
    expect(await hashVisitor(base)).not.toBe(
      await hashVisitor({ ...base, userAgent: "Other" }),
    );
  });

  it("returns 32 hexadecimal characters that do not contain the IP", async () => {
    const id = await hashVisitor(base);
    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toContain("203");
  });
});

describe("salt and day", () => {
  it("creates a different random salt each time", () => {
    expect(newSalt()).toMatch(/^[0-9a-f]{64}$/);
    expect(newSalt()).not.toBe(newSalt());
  });

  it("uses the UTC date as the day key", () => {
    expect(dayKey(new Date("2026-10-29T23:59:59Z"))).toBe("2026-10-29");
  });
});
