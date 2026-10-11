/**
 * Helpers for the Spanish and English versions of the site.
 * Spanish lives at `/` and English at `/en/`.
 * @module i18n/utils
 */
import es from "./es.json";
import en from "./en.json";

/** @typedef {"es" | "en"} Lang */

/** Languages the site is available in. */
export const languages = /** @type {const} */ (["es", "en"]);

/** Language used when none is given or a text is missing. */
export const defaultLang = /** @type {Lang} */ ("es");

/** @type {Record<Lang, Record<string, unknown>>} */
const dictionaries = { es, en };

/**
 * Finds the language of a page from its address.
 * @param {URL | string} url - The page address, or just its path.
 * @returns {Lang} `"en"` for `/en` and `/en/...`, `"es"` for everything else.
 */
export function getLangFromUrl(url) {
  const path = typeof url === "string" ? url : url.pathname;
  return path === "/en" || path.startsWith("/en/") ? "en" : "es";
}

/**
 * Pages whose address is different in each language.
 * Every other page has the same address, with `/en` in front for English.
 */
export const translatedRoutes = [
  { es: "/aviso-de-privacidad", en: "/privacy-notice" },
];

/**
 * Turns a path of the site into the path for a language.
 * Keeps a `#section` or `?query` at the end, and knows pages whose address
 * changes with the language (see `translatedRoutes`).
 * @param {string} path - A path starting with `/`, such as `/contact` or `/#about`, in either language.
 * @param {Lang} lang - The language of the path you want.
 * @returns {string} The path for that language, such as `/en/contact` or `/en/#about`.
 */
export function getLocalizedPath(path, lang) {
  const clean = stripLangPrefix(path.startsWith("/") ? path : `/${path}`);
  const end = clean.search(/[?#]/);
  const base = end === -1 ? clean : clean.slice(0, end);
  const rest = end === -1 ? "" : clean.slice(end);
  const route = translatedRoutes.find(
    (item) => item.es === base || item.en === base,
  );
  const localized = route ? route[lang] : base;
  return (lang === defaultLang ? localized : `/en${localized}`) + rest;
}

/**
 * Removes the `/en` prefix from a path, if it has one.
 * @param {string} path - A path starting with `/`.
 * @returns {string} The same path without the language prefix.
 */
export function stripLangPrefix(path) {
  if (path === "/en") return "/";
  return path.startsWith("/en/") || path.startsWith("/en#")
    ? path.slice(3) || "/"
    : path;
}

/**
 * Looks up a text by a dotted key such as `hero.title`.
 * @param {Record<string, unknown>} dictionary - A translation file.
 * @param {string} key - The dotted key.
 * @returns {string | undefined} The text, or undefined when the key is missing.
 */
function lookup(dictionary, key) {
  /** @type {unknown} */
  let value = dictionary;
  for (const part of key.split(".")) {
    if (typeof value !== "object" || value === null) return undefined;
    value = /** @type {Record<string, unknown>} */ (value)[part];
  }
  return typeof value === "string" ? value : undefined;
}

/**
 * Returns a function that translates keys for one language.
 * A missing English key falls back to Spanish; a missing key everywhere
 * returns the key itself. Missing keys are reported in the console.
 * @param {Lang} lang - The language to translate to.
 * @returns {(key: string, values?: Record<string, string | number>) => string} The `t` function.
 */
export function useTranslations(lang) {
  return function t(key, values) {
    let text = lookup(dictionaries[lang], key);
    if (text === undefined) {
      console.warn(`[i18n] Missing "${lang}" translation for "${key}"`);
      text = lookup(dictionaries[defaultLang], key) ?? key;
    }
    if (values) {
      for (const [name, value] of Object.entries(values)) {
        text = text.replaceAll(`{${name}}`, String(value));
      }
    }
    return text;
  };
}

/**
 * Returns every dotted key of a translation file, sorted.
 * Used by the test that keeps both languages in sync.
 * @param {Record<string, unknown>} dictionary - A translation file.
 * @param {string} [prefix] - Key prefix used while walking nested objects.
 * @returns {string[]} The sorted list of keys that hold a text.
 */
export function flattenKeys(dictionary, prefix = "") {
  return Object.entries(dictionary)
    .flatMap(([name, value]) => {
      const key = prefix ? `${prefix}.${name}` : name;
      return typeof value === "object" && value !== null
        ? flattenKeys(/** @type {Record<string, unknown>} */ (value), key)
        : [key];
    })
    .sort();
}
