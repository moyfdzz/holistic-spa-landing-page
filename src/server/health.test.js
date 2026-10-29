import { describe, expect, it } from "vitest";
import { checkHealth } from "./health.js";

describe("checkHealth", () => {
  it("answers 200 when the database answers", async () => {
    const result = await checkHealth({
      ping: async () => {},
      version: "1.2.3",
    });
    expect(result).toEqual({
      status: 200,
      body: { status: "ok", db: "ok", version: "1.2.3" },
    });
  });

  it("answers 503 when the database fails, without leaking the error", async () => {
    const result = await checkHealth({
      ping: async () => {
        throw new Error("password authentication failed for user TU_USUARIO");
      },
      version: "1.2.3",
    });
    expect(result.status).toBe(503);
    expect(result.body).toEqual({
      status: "error",
      db: "error",
      version: "1.2.3",
    });
    expect(JSON.stringify(result)).not.toContain("TU_USUARIO");
  });
});
