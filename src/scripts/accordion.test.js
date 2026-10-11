import { beforeEach, describe, expect, it } from "vitest";
import { initAccordion } from "./accordion.js";

describe("initAccordion", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-accordion-item id="q1" data-open="false">
        <button data-accordion-toggle aria-expanded="false">One</button>
      </div>
      <div data-accordion-item id="q2" data-open="false">
        <button data-accordion-toggle aria-expanded="false">Two</button>
      </div>`;
  });

  it("returns how many items it set up", () => {
    expect(initAccordion()).toBe(2);
  });

  it("opens and closes an item and keeps aria-expanded in sync", () => {
    initAccordion();
    const item = /** @type {HTMLElement} */ (document.getElementById("q1"));
    const button = /** @type {HTMLElement} */ (item.querySelector("button"));

    button.click();
    expect(item.getAttribute("data-open")).toBe("true");
    expect(button.getAttribute("aria-expanded")).toBe("true");

    button.click();
    expect(item.getAttribute("data-open")).toBe("false");
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  it("does not affect the other items", () => {
    initAccordion();
    document
      .querySelector("#q1 button")
      ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.getElementById("q2")?.getAttribute("data-open")).toBe(
      "false",
    );
  });
});
