import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env.js";

const url = "postgresql://user:TU_PASSWORD@host.example/db?sslmode=require";

describe("parseServerEnv", () => {
  it("returns the validated variables", () => {
    expect(parseServerEnv({ DATABASE_URL: url, ASSETS: {} })).toEqual({
      DATABASE_URL: url,
    });
  });

  it("fails when a variable is missing, naming it", () => {
    expect(() => parseServerEnv({})).toThrow(
      "Invalid server environment: DATABASE_URL (missing)",
    );
  });

  it("fails when the value is not a Postgres address, without printing it", () => {
    let message = "";
    try {
      parseServerEnv({ DATABASE_URL: "mysql://user:TU_PASSWORD@host/db" });
    } catch (error) {
      message = /** @type {Error} */ (error).message;
    }
    expect(message).toBe(
      "Invalid server environment: DATABASE_URL (wrong format)",
    );
    expect(message).not.toContain("TU_PASSWORD");
  });
});
