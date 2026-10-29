import { describe, expect, it } from "vitest";
import { addDays, dayKey, hashVisitor, newSalt } from "./visitor.js";

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

  it("uses the date in Monterrey as the day key", () => {
    // 2026-10-29 23:59 UTC is still the 29th in Monterrey (UTC-6) ...
    expect(dayKey(new Date("2026-10-29T23:59:59Z"))).toBe("2026-10-29");
    // ... and 2026-10-30 05:59 UTC is still the 29th there, while 06:00 UTC is the 30th.
    expect(dayKey(new Date("2026-10-30T05:59:59Z"))).toBe("2026-10-29");
    expect(dayKey(new Date("2026-10-30T06:00:00Z"))).toBe("2026-10-30");
  });

  it("adds days across month and year ends", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-03-15", 0)).toBe("2026-03-15");
  });
});
