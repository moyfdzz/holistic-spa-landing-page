/**
 * Language switcher behavior: keeps the `#section` when switching language,
 * remembers the visitor's choice, and offers English once to visitors whose
 * browser is in English. It never redirects on its own.
 * @module scripts/language
 */

const STORAGE_KEY = "lang";

/**
 * Reads the saved language choice.
 * @returns {string | null} The saved language code, or null when none is saved or storage is blocked.
 */
export function getSavedLang() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Saves the language choice. Does nothing when storage is blocked.
 * @param {string} lang - The language code to remember.
 */
export function saveLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Private windows or blocked storage: the choice just is not remembered.
  }
}

/**
 * Wires up the language links and the English suggestion.
 * @param {Document} [root] - The document to work on.
 * @param {string} [browserLanguage] - The browser language, for example `en-US`.
 * @returns {{ links: number, suggested: boolean }} How many links were set up and whether the suggestion was shown.
 */
export function initLanguage(
  root = document,
  browserLanguage = globalThis.navigator?.language ?? "",
) {
  const links = Array.from(root.querySelectorAll("[data-lang-link]"));
  const hash = root.defaultView?.location.hash ?? "";

  links.forEach((link) => {
    const base = link.getAttribute("href")?.split("#")[0] ?? "";
    if (hash) link.setAttribute("href", base + hash);
    link.addEventListener("click", () => {
      saveLang(link.getAttribute("data-lang-link") ?? "");
    });
  });

  const suggestion = root.querySelector("[data-lang-suggest]");
  const shouldSuggest =
    suggestion !== null &&
    getSavedLang() === null &&
    browserLanguage.toLowerCase().startsWith("en");
  if (suggestion && shouldSuggest) {
    suggestion.removeAttribute("hidden");
    suggestion
      .querySelector("[data-lang-dismiss]")
      ?.addEventListener("click", () => {
        saveLang("es");
        suggestion.setAttribute("hidden", "");
      });
  }

  return {
    links: links.length,
    suggested: Boolean(suggestion && shouldSuggest),
  };
}
