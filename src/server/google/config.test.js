// @vitest-environment node
import { describe, expect, it } from "vitest";
import { readSearchConsoleConfig } from "./config.js";

const pem = "-----BEGIN PRIVATE KEY-----\nQUJD\n-----END PRIVATE KEY-----\n";
const json = JSON.stringify({
  client_email: "reader@example-project.iam.gserviceaccount.com",
  private_key: pem,
});

describe("readSearchConsoleConfig", () => {
  it("says it is not configured and names what is missing", () => {
    expect(readSearchConsoleConfig({})).toEqual({
      configured: false,
      missing: ["GOOGLE_SERVICE_ACCOUNT_JSON", "SEARCH_CONSOLE_SITE_URL"],
    });
    expect(
      readSearchConsoleConfig({
        SEARCH_CONSOLE_SITE_URL: "sc-domain:example.com",
      }),
    ).toMatchObject({
      configured: false,
      missing: ["GOOGLE_SERVICE_ACCOUNT_JSON"],
    });
  });

  it("counts an empty value as missing", () => {
    expect(
      readSearchConsoleConfig({
        GOOGLE_SERVICE_ACCOUNT_JSON: "  ",
        SEARCH_CONSOLE_SITE_URL: "sc-domain:example.com",
      }),
    ).toMatchObject({
      configured: false,
      missing: ["GOOGLE_SERVICE_ACCOUNT_JSON"],
    });
  });

  it("reads a domain property and a URL property", () => {
    for (const siteUrl of [
      "sc-domain:masajesrelaxmty.com",
      "https://www.masajesrelaxmty.com/",
    ]) {
      const config = readSearchConsoleConfig({
        GOOGLE_SERVICE_ACCOUNT_JSON: json,
        SEARCH_CONSOLE_SITE_URL: siteUrl,
      });
      expect(config).toMatchObject({ configured: true, siteUrl });
    }
  });

  it("refuses a property that is neither, without echoing secrets", () => {
    for (const siteUrl of [
      "masajesrelaxmty.com",
      "https://www.masajesrelaxmty.com",
      "javascript:alert(1)",
    ]) {
      expect(() =>
        readSearchConsoleConfig({
          GOOGLE_SERVICE_ACCOUNT_JSON: json,
          SEARCH_CONSOLE_SITE_URL: siteUrl,
        }),
      ).toThrow("SEARCH_CONSOLE_SITE_URL is not a property");
    }
  });

  it("refuses a key that is wrong without showing it", () => {
    try {
      readSearchConsoleConfig({
        GOOGLE_SERVICE_ACCOUNT_JSON: JSON.stringify({
          client_email: "x@y",
          private_key: "secreto-del-archivo",
        }),
        SEARCH_CONSOLE_SITE_URL: "sc-domain:example.com",
      });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).toContain("private_key");
      expect(String(error)).not.toContain("secreto-del-archivo");
    }
  });
});
