import { describe, expect, it, vi } from "vitest";
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

  it("keeps what was reported before the tracker listens and hands each event over once", async () => {
    // A fresh copy of the module, so no earlier event is waiting.
    vi.resetModules();
    const fresh = await import("./track.js");
    const handle = vi.fn();
    fresh.track("form_start");
    fresh.receiveTracked(document, handle);
    fresh.track("form_submit");
    expect(handle.mock.calls.map(([event]) => event.type)).toEqual([
      "form_start",
      "form_submit",
    ]);
  });
});
