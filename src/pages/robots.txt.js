import { buildRobotsTxt } from "../utils/robots.js";

/**
 * robots.txt: lets search engines in, blocks AI training crawlers and points to the sitemap.
 * @param {{ site: URL | undefined }} context - Astro context with the site address.
 * @returns {Response} The robots.txt file.
 */
export function GET({ site }) {
  const sitemap = new URL("sitemap-index.xml", site);
  return new Response(buildRobotsTxt(sitemap.href), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
