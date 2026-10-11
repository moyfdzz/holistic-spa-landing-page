import { beforeEach, describe, expect, it } from "vitest";
import { getSavedLang, initLanguage, saveLang } from "./language.js";

const markup = `
  <a data-lang-link="es" href="/contact">ES</a>
  <a data-lang-link="en" href="/en/contact">EN</a>
  <div data-lang-suggest hidden>
    <a data-lang-link="en" href="/en/contact">Switch</a>
    <button data-lang-dismiss>x</button>
  </div>`;

describe("initLanguage", () => {
  beforeEach(() => {
    localStorage.clear();
    window.location.hash = "";
    document.body.innerHTML = markup;
  });

  it("keeps the #section when switching language", () => {
    window.location.hash = "#faq";
    initLanguage(document, "es-MX");
    expect(
      document.querySelector('[data-lang-link="en"]')?.getAttribute("href"),
    ).toBe("/en/contact#faq");
  });

  it("remembers the choice when a language link is clicked", () => {
    initLanguage(document, "es-MX");
    document
      .querySelector('a[data-lang-link="en"]')
      ?.dispatchEvent(
        new MouseEvent("click", { bubbles: true, cancelable: true }),
      );
    expect(getSavedLang()).toBe("en");
  });

  it("suggests English to English browsers on a first visit, without redirecting", () => {
    const result = initLanguage(document, "en-US");
    expect(result.suggested).toBe(true);
    expect(
      document.querySelector("[data-lang-suggest]")?.hasAttribute("hidden"),
    ).toBe(false);
  });

  it("does not suggest English to Spanish browsers or returning visitors", () => {
    expect(initLanguage(document, "es-MX").suggested).toBe(false);
    saveLang("es");
    expect(initLanguage(document, "en-US").suggested).toBe(false);
  });

  it("hides the suggestion for good when it is dismissed", () => {
    initLanguage(document, "en-US");
    document
      .querySelector("[data-lang-dismiss]")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(
      document.querySelector("[data-lang-suggest]")?.hasAttribute("hidden"),
    ).toBe(true);
    expect(getSavedLang()).toBe("es");
  });

  it("works when there is nothing to set up", () => {
    document.body.innerHTML = "<p>Nothing</p>";
    expect(initLanguage(document, "en")).toEqual({
      links: 0,
      suggested: false,
    });
  });
});
