import { describe, expect, it } from "vitest";
import { TRACK_EVENT, track } from "./track.js";

describe("track", () => {
  it("dispatches an event on the document with the type and props", () => {
    /** @type {CustomEvent | undefined} */
    let received;
    const listener = (/** @type {Event} */ event) => {
      received = /** @type {CustomEvent} */ (event);
    };
    document.addEventListener(TRACK_EVENT, listener);
    track("form_error", { type: "validation" });
    document.removeEventListener(TRACK_EVENT, listener);
    expect(received?.detail).toEqual({
      type: "form_error",
      props: { type: "validation" },
    });
  });
});
