/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

// getViteConfig reuses the Astro/Vite setup (React JSX transform, aliases).
export default getViteConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.js"],
    include: ["src/**/*.test.{js,jsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/**/*.{js,jsx}"],
      // Legacy browser script, replaced by later tickets.
      exclude: ["src/scripts/**", "src/**/*.test.{js,jsx}"],
    },
  },
});
