import { describe, expect, it } from "vitest";
import { describeError } from "./errors.js";
import { parseServerEnv } from "./env.js";

describe("describeError", () => {
  it("keeps the class and the code, not the message", () => {
    const error = Object.assign(
      new Error("password authentication failed for user TU_USUARIO"),
      { name: "NeonDbError", code: "28P01" },
    );
    expect(describeError(error)).toBe("NeonDbError (28P01)");
  });

  it("keeps only the class when there is no code", () => {
    expect(describeError(new TypeError("fetch failed: host.example"))).toBe(
      "TypeError",
    );
  });

  it("keeps the environment message, which names variables only", () => {
    let error;
    try {
      parseServerEnv({
        DATABASE_URL: "psql 'postgresql://u:TU_PASSWORD@h/db'",
      });
    } catch (caught) {
      error = caught;
    }
    expect(describeError(error)).toBe(
      "Error: Invalid server environment: DATABASE_URL",
    );
    expect(describeError(error)).not.toContain("TU_PASSWORD");
  });

  it("handles values that are not errors", () => {
    expect(describeError("boom")).toBe("non-error value thrown");
  });
});
