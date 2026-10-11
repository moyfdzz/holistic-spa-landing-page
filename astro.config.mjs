// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";

// Static output by default; the Vercel adapter leaves room for API routes later.
export default defineConfig({
  // Keep whitespace between inline elements, exactly as in the original pages.
  compressHTML: false,
  integrations: [react()],
  adapter: vercel(),
});
