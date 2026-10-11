/**
 * Site header behavior: a shadow when the page is scrolled and an accessible
 * slide-in menu on small screens.
 * @module scripts/header
 */
import { trapFocus } from "../utils/focus.js";

/** Scroll distance (px) after which the header gets its "scrolled" look. */
const SCROLLED_AFTER = 8;
/** Viewport width (px) from which the menu is always visible (matches the CSS). */
const DESKTOP_MIN_WIDTH = 960;

/**
 * Wires up the header found in the given root.
 * @param {Document} [root] - Document that contains the header markup.
 * @returns {{ open: () => void, close: () => void } | null} Controls for the menu, or null when there is no header.
 */
export function initHeader(root = document) {
  const header = /** @type {HTMLElement | null} */ (
    root.querySelector("[data-header]")
  );
  const toggle = /** @type {HTMLElement | null} */ (
    root.querySelector("[data-nav-toggle]")
  );
  const nav = /** @type {HTMLElement | null} */ (
    root.querySelector("[data-nav]")
  );
  const overlay = /** @type {HTMLElement | null} */ (
    root.querySelector("[data-nav-overlay]")
  );
  if (!header || !toggle || !nav) return null;

  // Everything outside the header is made inert, so focus cannot leave the open menu.
  const inertTargets = Array.from(
    root.querySelectorAll("main, footer, [data-whatsapp-button]"),
  );

  /** @param {boolean} isOpen - Whether the menu should be open. */
  const setOpen = (isOpen) => {
    nav.setAttribute("data-open", String(isOpen));
    overlay?.setAttribute("data-open", String(isOpen));
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute(
      "aria-label",
      (isOpen ? toggle.dataset.labelClose : toggle.dataset.labelOpen) ??
        (isOpen ? "Cerrar menú" : "Abrir menú"),
    );
    root.body.classList.toggle("nav-open", isOpen);
    inertTargets.forEach((el) => {
      el.toggleAttribute("inert", isOpen);
    });
  };

  const open = () => {
    setOpen(true);
    nav.querySelector("a")?.focus();
  };
  const close = () => setOpen(false);

  toggle.addEventListener("click", () => {
    if (toggle.getAttribute("aria-expanded") === "true") {
      close();
    } else {
      open();
    }
  });

  overlay?.addEventListener("click", () => {
    close();
    toggle.focus();
  });

  nav.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a")) close();
  });

  header.addEventListener("keydown", (event) => {
    if (toggle.getAttribute("aria-expanded") !== "true") return;
    if (event.key === "Escape") {
      close();
      toggle.focus();
      return;
    }
    trapFocus(event, header);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth >= DESKTOP_MIN_WIDTH) close();
  });

  const updateScrolled = () => {
    header.setAttribute(
      "data-scrolled",
      String(window.scrollY > SCROLLED_AFTER),
    );
  };
  window.addEventListener("scroll", updateScrolled, { passive: true });
  updateScrolled();

  return { open, close };
}
