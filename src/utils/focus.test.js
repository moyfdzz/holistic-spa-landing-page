import { beforeEach, describe, expect, it } from "vitest";
import { getFocusable, trapFocus } from "./focus.js";

/**
 * Builds a keydown event for Tab.
 * @param {boolean} [shiftKey] - Whether Shift is held.
 * @returns {KeyboardEvent} The event.
 */
function tab(shiftKey = false) {
  return new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey,
    cancelable: true,
  });
}

describe("focus helpers", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="box">
        <a href="/a" id="a">A</a>
        <button id="b">B</button>
        <button id="off" disabled>Off</button>
        <div hidden><button id="inside-hidden">Hidden</button></div>
        <input id="c" />
      </div>`;
  });

  it("lists only visible, enabled focusable elements in order", () => {
    const box = /** @type {HTMLElement} */ (document.getElementById("box"));
    expect(getFocusable(box).map((el) => el.id)).toEqual(["a", "b", "c"]);
  });

  it("moves focus from the last element to the first on Tab", () => {
    const box = /** @type {HTMLElement} */ (document.getElementById("box"));
    document.getElementById("c")?.focus();
    const event = tab();
    expect(trapFocus(event, box)).toBe(true);
    expect(event.defaultPrevented).toBe(true);
    expect(document.activeElement?.id).toBe("a");
  });

  it("moves focus from the first element to the last on Shift+Tab", () => {
    const box = /** @type {HTMLElement} */ (document.getElementById("box"));
    document.getElementById("a")?.focus();
    expect(trapFocus(tab(true), box)).toBe(true);
    expect(document.activeElement?.id).toBe("c");
  });

  it("leaves Tab alone in the middle and ignores other keys", () => {
    const box = /** @type {HTMLElement} */ (document.getElementById("box"));
    document.getElementById("b")?.focus();
    expect(trapFocus(tab(), box)).toBe(false);
    const other = new KeyboardEvent("keydown", { key: "Enter" });
    expect(trapFocus(other, box)).toBe(false);
  });
});
