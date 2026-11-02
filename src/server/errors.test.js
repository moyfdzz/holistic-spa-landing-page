import { describe, expect, it } from "vitest";
import { describeError, SafeError, safeWord } from "./errors.js";
import { parseServerEnv } from "./env.js";

describe("describeError", () => {
  it("keeps the message of a SafeError, which we write without secrets", () => {
    expect(
      describeError(
        new SafeError("Search Console API answered 403 (PERMISSION_DENIED)"),
      ),
    ).toBe("SafeError: Search Console API answered 403 (PERMISSION_DENIED)");
  });

  it("still hides the message of any other error", () => {
    expect(describeError(new Error("https://host.example/key=TU_CLAVE"))).toBe(
      "Error",
    );
  });

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
      "Error: Invalid server environment: DATABASE_URL (wrong format)",
    );
    expect(describeError(error)).not.toContain("TU_PASSWORD");
  });

  it("handles values that are not errors", () => {
    expect(describeError("boom")).toBe("non-error value thrown");
  });
});

describe("safeWord", () => {
  it("keeps a short status or error code", () => {
    expect(safeWord("PERMISSION_DENIED")).toBe("PERMISSION_DENIED");
    expect(safeWord("invalid_grant")).toBe("invalid_grant");
  });

  it("drops anything else", () => {
    expect(safeWord("see https://x.example/?token=TU_TOKEN")).toBe("unknown");
    expect(safeWord("a".repeat(65))).toBe("unknown");
    expect(safeWord("")).toBe("unknown");
    expect(safeWord(undefined)).toBe("unknown");
    expect(safeWord({ status: "X" })).toBe("unknown");
  });
});
