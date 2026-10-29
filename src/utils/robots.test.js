import { describe, expect, it } from "vitest";
import { aiTrainingCrawlers, buildRobotsTxt } from "./robots.js";

describe("buildRobotsTxt", () => {
  const text = buildRobotsTxt("https://example.com/sitemap-index.xml");

  it("lets every other crawler in and points to the sitemap", () => {
    expect(text).toContain("User-agent: *\nAllow: /\n");
    expect(text).toContain("Sitemap: https://example.com/sitemap-index.xml");
  });

  it("blocks each AI training crawler on the whole site", () => {
    for (const name of aiTrainingCrawlers) {
      expect(text).toContain(`User-agent: ${name}\nDisallow: /\n`);
    }
  });

  it("does not block search or answer crawlers", () => {
    for (const name of [
      "Googlebot",
      "OAI-SearchBot",
      "ChatGPT-User",
      "Claude-SearchBot",
      "PerplexityBot",
    ]) {
      expect(text).not.toContain(`User-agent: ${name}`);
    }
  });
});
