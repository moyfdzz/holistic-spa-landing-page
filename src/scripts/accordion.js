/**
 * FAQ accordion. Each toggle button controls one answer; the open state lives
 * in `aria-expanded` and `data-open`, and CSS does the animation.
 * @module scripts/accordion
 */

/**
 * Wires up every accordion item found in the given root.
 * @param {ParentNode} [root] - Where to look for `[data-accordion-item]` elements.
 * @returns {number} How many accordion items were set up.
 */
export function initAccordion(root = document) {
  const items = Array.from(root.querySelectorAll("[data-accordion-item]"));

  items.forEach((item) => {
    const button = item.querySelector("[data-accordion-toggle]");
    if (!button) return;

    button.addEventListener("click", () => {
      const willOpen = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(willOpen));
      item.setAttribute("data-open", String(willOpen));
    });
  });

  return items.length;
}
