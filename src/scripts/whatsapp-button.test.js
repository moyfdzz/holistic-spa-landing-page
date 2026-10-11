import { beforeEach, describe, expect, it } from "vitest";
import { initWhatsAppButton } from "./whatsapp-button.js";

describe("initWhatsAppButton", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="name" />
      <a href="#x" id="other">Link</a>
      <a data-whatsapp-button href="https://wa.me/1">WhatsApp</a>`;
  });

  /** @returns {string | null} The current hidden state of the button. */
  const state = () =>
    document
      .querySelector("[data-whatsapp-button]")
      ?.getAttribute("data-hidden") ?? null;

  it("does nothing when there is no button", () => {
    document.body.innerHTML = "<p>No button</p>";
    expect(initWhatsAppButton(document)).toBe(false);
  });

  it("hides while a form field is focused and shows again after", () => {
    expect(initWhatsAppButton(document)).toBe(true);
    const input = /** @type {HTMLInputElement} */ (
      document.getElementById("name")
    );
    input.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(state()).toBe("typing");
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    expect(state()).toBeNull();
  });

  it("stays visible when something other than a field is focused", () => {
    initWhatsAppButton(document);
    document
      .getElementById("other")
      ?.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(state()).toBeNull();
  });
});
