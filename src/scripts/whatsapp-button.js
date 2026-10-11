/**
 * Hides the floating WhatsApp button when it would get in the way: while a form
 * field is focused (phones, keyboard open) and when the footer is on screen.
 * @module scripts/whatsapp-button
 */

const FIELD_SELECTOR = "input, textarea, select";

/**
 * Wires up the hiding rules of the floating button.
 * @param {Document} [root] - The document to work on.
 * @returns {boolean} True when a button was found and set up.
 */
export function initWhatsAppButton(root = document) {
  const button = root.querySelector("[data-whatsapp-button]");
  if (!button) return false;

  let typing = false;
  let nearFooter = false;

  const update = () => {
    if (nearFooter) button.setAttribute("data-hidden", "footer");
    else if (typing) button.setAttribute("data-hidden", "typing");
    else button.removeAttribute("data-hidden");
  };

  root.addEventListener("focusin", (event) => {
    typing =
      event.target instanceof Element && event.target.matches(FIELD_SELECTOR);
    update();
  });
  root.addEventListener("focusout", () => {
    typing = false;
    update();
  });

  const footer = root.querySelector("footer");
  if (footer && "IntersectionObserver" in globalThis) {
    new IntersectionObserver((entries) => {
      nearFooter = entries.some((entry) => entry.isIntersecting);
      update();
    }).observe(footer);
  }

  return true;
}
