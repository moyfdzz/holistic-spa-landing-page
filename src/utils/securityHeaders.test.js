// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { securityHeaders } from "./securityHeaders.js";

/** @returns {Record<string, string>} The headers `public/_headers` gives to every static file. */
function staticHeaders() {
  const file = readFileSync(
    new URL("../../public/_headers", import.meta.url),
    "utf8",
  );
  const lines = file.split(/\r?\n/);
  const block = lines.slice(lines.indexOf("/*") + 1);
  const end = block.findIndex((line) => !line.startsWith("  "));
  return Object.fromEntries(
    block.slice(0, end === -1 ? block.length : end).map((line) => {
      const colon = line.indexOf(":");
      return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
    }),
  );
}

describe("securityHeaders", () => {
  it("matches what static files get", () => {
    expect(securityHeaders).toEqual(staticHeaders());
  });
});
