/**
 * Keyboard focus helpers.
 * @module utils/focus
 */

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Tells whether an element is an HTML element that is not hidden.
 * @param {Element} el - Element to check.
 * @returns {el is HTMLElement} True when the element is a visible HTML element.
 */
function isVisibleHtmlElement(el) {
  return el instanceof HTMLElement && !el.hidden && !el.closest("[hidden]");
}

/**
 * Returns the elements inside a container that can receive keyboard focus and
 * are not hidden.
 * @param {ParentNode} container - Element to search in.
 * @returns {HTMLElement[]} Focusable elements, in document order.
 */
export function getFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    isVisibleHtmlElement,
  );
}

/**
 * Keeps keyboard focus inside a container: Tab on the last element moves to the
 * first one, and Shift+Tab on the first element moves to the last one. Call it
 * from a `keydown` handler while a dialog or drawer is open.
 * @param {KeyboardEvent} event - The keydown event.
 * @param {ParentNode} container - Element that should hold the focus.
 * @returns {boolean} True when the event was a Tab that this function redirected.
 */
export function trapFocus(event, container) {
  if (event.key !== "Tab") return false;

  const items = getFocusable(container);
  if (items.length === 0) return false;

  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;

  if (event.shiftKey && active === first) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}
