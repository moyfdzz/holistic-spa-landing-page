import { describe, expect, it } from "vitest";
import { readAdminConfig } from "./clerk.js";

describe("readAdminConfig", () => {
  it("accepts a complete configuration", () => {
    const result = readAdminConfig({
      secretKey: "sk_test_x",
      publishableKey: "pk_test_x",
      adminEmails: "a@b.c",
    });
    expect(result.ok).toBe(true);
  });

  it("names the settings that are missing, never their values", () => {
    const result = readAdminConfig({
      secretKey: "sk_test_TU_CLAVE",
      publishableKey: " ",
      adminEmails: undefined,
    });
    expect(result).toEqual({
      ok: false,
      missing: ["PUBLIC_CLERK_PUBLISHABLE_KEY", "ADMIN_EMAILS"],
    });
    expect(JSON.stringify(result)).not.toContain("TU_CLAVE");
  });
});
