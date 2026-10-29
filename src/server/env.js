/**
 * Server-side environment variables, validated once with Zod.
 * Server code only: never import this from a client island.
 * @module server/env
 */
import { z } from "zod";

const serverEnvSchema = z.object({
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\//, "must be a Postgres connection string"),
});

/** @typedef {z.infer<typeof serverEnvSchema>} ServerEnv */

/**
 * Checks the server variables and returns the ones the code needs.
 * On failure it throws with the variable names only, never their values.
 * @param {Record<string, unknown>} source - The bindings of the Worker (or `process.env` in scripts).
 * @returns {ServerEnv} The validated variables.
 */
export function parseServerEnv(source) {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    // Name each variable and say whether it is missing or malformed, never its value.
    const problems = new Map();
    for (const issue of result.error.issues) {
      const reason = issue.code === "invalid_type" ? "missing" : "wrong format";
      problems.set(String(issue.path[0]), reason);
    }
    const list = [...problems].map(([name, reason]) => `${name} (${reason})`);
    throw new Error(`Invalid server environment: ${list.join(", ")}`);
  }
  return result.data;
}
