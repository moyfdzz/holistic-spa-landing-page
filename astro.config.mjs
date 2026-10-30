// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";
import { site } from "./src/config/site.js";

// Static output by default; the Cloudflare adapter leaves room for API routes later.
export default defineConfig({
  // Production address, used for canonical links, the sitemap and sharing.
  site: site.url,
  // One file per page (contact.html): Cloudflare serves it at /contact, while the home pages
  // (index.html) keep the trailing slash, as in the canonical links and the sitemap.
  build: { format: "preserve" },
  // Keep whitespace between inline elements, exactly as in the original pages.
  compressHTML: false,
  // Keep links to the old static URLs working (Google results, shared links).
  redirects: {
    "/index.html": { status: 301, destination: "/" },
    "/contact.html": { status: 301, destination: "/contact" },
  },
  // Spanish at /, English at /en/.
  i18n: {
    locales: ["es", "en"],
    defaultLocale: "es",
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    react(),
    icon(),
    sitemap({
      // The admin area is private: it must not be listed for search engines.
      filter: (page) => !new URL(page).pathname.startsWith("/admin"),
      i18n: { defaultLocale: "es", locales: { es: "es-MX", en: "en-US" } },
      // Same addresses as the canonical links: no trailing slash, except the home pages.
      serialize(item) {
        const trim = (/** @type {string} */ url) =>
          // The English home page is served at /en/ (the site is built as en/index.html).
          url
            .replace(/\/en\/?$/, "/en/")
            .replace(/(.)\/$/, (match, char) =>
              char === "/" || url.endsWith("/en") || url.endsWith("/en/")
                ? match
                : char,
            );
        item.url = trim(item.url);
        item.links?.forEach((link) => {
          link.url = trim(link.url);
        });
        return item;
      },
    }),
  ],
  // No sessions are needed yet; this avoids provisioning a KV namespace.
  session: false,
  // Images are processed at build time, so no paid Images binding is needed.
  // Vitest runs the unit tests in jsdom, where the adapter's workerd runtime cannot start.
  adapter: process.env.VITEST
    ? undefined
    : cloudflare({ imageService: "compile" }),
});
