/**
 * Shapes the entries of the sitemap (see `astro.config.mjs`).
 * @module utils/sitemap
 */
import { getLangFromUrl, getLocalizedPath } from "../i18n/utils.js";
import { absoluteUrl, languageAlternates, publicPath } from "./seo.js";

/**
 * Gives a sitemap entry the same address as the page's canonical link (no trailing
 * slash, except the home pages) and the same language alternates as its head.
 * The sitemap plugin cannot pair pages whose address changes with the language,
 * so the alternates are built here.
 * @template {{ url: string }} Item
 * @param {Item} item - The entry the plugin built.
 * @returns {Item & { links: ReturnType<typeof languageAlternates> }} The entry with its public address and alternates.
 */
export function serializeSitemapItem(item) {
  const { origin, pathname } = new URL(item.url);
  const path = publicPath(pathname);
  const url = absoluteUrl(getLocalizedPath(path, getLangFromUrl(path)), origin);
  return { ...item, url, links: languageAlternates(path, origin) };
}
