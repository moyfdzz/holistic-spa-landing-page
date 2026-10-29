/**
 * Crawlers that collect pages to train AI models. They are blocked because they bring no
 * visitors. Search and answer crawlers (Googlebot, OAI-SearchBot, Claude-SearchBot,
 * PerplexityBot, ChatGPT-User...) are not listed, so the open `*` rule lets them in and the
 * business can still show up in AI answers.
 */
export const aiTrainingCrawlers = [
  "GPTBot",
  "ClaudeBot",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bytespider",
  "meta-externalagent",
];

/**
 * Builds the text of robots.txt.
 * @param {string} sitemapUrl - Full address of the sitemap index.
 * @returns {string} The robots.txt content.
 */
export function buildRobotsTxt(sitemapUrl) {
  const blocked = aiTrainingCrawlers
    .map((name) => `User-agent: ${name}\nDisallow: /\n`)
    .join("\n");
  return `User-agent: *\nAllow: /\n\n${blocked}\nSitemap: ${sitemapUrl}\n`;
}
