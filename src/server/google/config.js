/**
 * Reads the Google settings of the Worker. They are optional: without them the import is left
 * out, so the site can be deployed before the secrets exist.
 * @module server/google/config
 */
import { parseServiceAccount } from "./auth.js";

/** A Search Console property: a domain (`sc-domain:example.com`) or a URL prefix ending in `/`. */
const PROPERTY = /^(sc-domain:[a-z0-9.-]+|https?:\/\/\S+\/)$/i;

/**
 * @typedef {{ configured: false, missing: string[] } | { configured: true, account: import("./auth.js").ServiceAccount, siteUrl: string }} SearchConsoleConfig
 */

/**
 * Reads the settings of the Search Console import.
 * @param {Record<string, unknown>} env - The bindings of the Worker.
 * @returns {SearchConsoleConfig} The settings, or the names of what is missing.
 * @throws {Error} When a setting is there but wrong, naming it and never giving its value.
 */
export function readSearchConsoleConfig(env) {
  const json = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const siteUrl = env.SEARCH_CONSOLE_SITE_URL;
  const missing = [
    ["GOOGLE_SERVICE_ACCOUNT_JSON", json],
    ["SEARCH_CONSOLE_SITE_URL", siteUrl],
  ]
    .filter(([, value]) => typeof value !== "string" || value.trim() === "")
    .map(([name]) => String(name));
  if (missing.length > 0) return { configured: false, missing };
  if (!PROPERTY.test(String(siteUrl).trim())) {
    throw new Error(
      "SEARCH_CONSOLE_SITE_URL is not a property: use sc-domain:example.com or a URL that ends in /",
    );
  }
  return {
    configured: true,
    account: parseServiceAccount(String(json)),
    siteUrl: String(siteUrl).trim(),
  };
}
