/**
 * robots.txt: lets search engines in and points them to the sitemap.
 * @param {{ site: URL | undefined }} context - Astro context with the site address.
 * @returns {Response} The robots.txt file.
 */
export function GET({ site }) {
  const sitemap = new URL("sitemap-index.xml", site);
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: ${sitemap.href}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
