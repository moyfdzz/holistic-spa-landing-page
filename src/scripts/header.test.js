import { beforeEach, describe, expect, it } from "vitest";
import { initHeader } from "./header.js";

describe("initHeader", () => {
  beforeEach(() => {
    document.body.className = "";
    document.body.innerHTML = `
      <header data-header>
        <button data-nav-toggle aria-expanded="false" aria-label="Abrir menú"><i class="fas fa-bars"></i></button>
        <nav data-nav data-open="false"><a href="/one" id="one">One</a><a href="/two">Two</a></nav>
        <div data-nav-overlay data-open="false"></div>
      </header>
      <main><a href="/x">Main link</a></main>
      <footer>Footer</footer>`;
  });

  /** @returns {HTMLElement} The toggle button. */
  const toggle = () =>
    /** @type {HTMLElement} */ (document.querySelector("[data-nav-toggle]"));
  /** @returns {HTMLElement} The nav element. */
  const nav = () =>
    /** @type {HTMLElement} */ (document.querySelector("[data-nav]"));

  it("does nothing when the header markup is missing", () => {
    document.body.innerHTML = "<p>No header</p>";
    expect(initHeader()).toBeNull();
  });

  it("opens and closes the menu with the toggle button", () => {
    initHeader();
    toggle().click();
    expect(nav().getAttribute("data-open")).toBe("true");
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().getAttribute("aria-label")).toBe("Cerrar menú");
    expect(document.body.classList.contains("nav-open")).toBe(true);
    expect(document.querySelector("main")?.hasAttribute("inert")).toBe(true);
    expect(document.activeElement?.id).toBe("one");

    toggle().click();
    expect(nav().getAttribute("data-open")).toBe("false");
    expect(toggle().getAttribute("aria-label")).toBe("Abrir menú");
    expect(document.querySelector("main")?.hasAttribute("inert")).toBe(false);
  });

  it("closes with Escape and returns focus to the toggle", () => {
    initHeader();
    toggle().click();
    document
      .querySelector("[data-header]")
      ?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(toggle());
  });

  it("closes when a link inside the menu is clicked", () => {
    initHeader();
    toggle().click();
    document
      .getElementById("one")
      ?.addEventListener("click", (e) => e.preventDefault());
    document.getElementById("one")?.click();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("marks the header as scrolled after scrolling down", () => {
    initHeader();
    const header = document.querySelector("[data-header]");
    expect(header?.getAttribute("data-scrolled")).toBe("false");

    Object.defineProperty(window, "scrollY", {
      value: 200,
      configurable: true,
    });
    window.dispatchEvent(new Event("scroll"));
    expect(header?.getAttribute("data-scrolled")).toBe("true");
    Object.defineProperty(window, "scrollY", { value: 0, configurable: true });
  });
});
