// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import icon from "astro-icon";

// Static output by default; the Vercel adapter leaves room for API routes later.
export default defineConfig({
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
  integrations: [react(), icon()],
  adapter: vercel(),
});
