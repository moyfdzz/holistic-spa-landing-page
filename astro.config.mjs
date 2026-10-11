// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import icon from "astro-icon";
import sitemap from "@astrojs/sitemap";
import { site } from "./src/config/site.js";

// Static output by default; the Vercel adapter leaves room for API routes later.
export default defineConfig({
  // Production address, used for canonical links, the sitemap and sharing.
  site: site.url,
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
      i18n: { defaultLocale: "es", locales: { es: "es-MX", en: "en-US" } },
      // Same addresses as the canonical links: no trailing slash, except the home pages.
      serialize(item) {
        const trim = (/** @type {string} */ url) =>
          url.replace(/(.)\/$/, (match, char) =>
            char === "/" || url.endsWith("/en/") ? match : char,
          );
        item.url = trim(item.url);
        item.links?.forEach((link) => {
          link.url = trim(link.url);
        });
        return item;
      },
    }),
  ],
  adapter: vercel(),
});
