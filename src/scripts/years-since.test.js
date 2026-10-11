import { beforeEach, describe, expect, it } from "vitest";
import { initYearsSince } from "./years-since.js";

describe("initYearsSince", () => {
  const now = new Date("2030-03-01T12:00:00Z");

  beforeEach(() => {
    document.body.innerHTML = `
      <p>Más de <span id="ok" data-years-since="2017">9</span> años</p>
      <p><span id="bad" data-years-since="abc">9</span></p>
      <p><span id="future" data-years-since="2040">9</span></p>`;
  });

  it("writes the whole years since the start year", () => {
    expect(initYearsSince(document, now)).toBe(1);
    expect(document.getElementById("ok")?.textContent).toBe("13");
  });

  it("keeps the build-time number when the year is invalid or in the future", () => {
    initYearsSince(document, now);
    expect(document.getElementById("bad")?.textContent).toBe("9");
    expect(document.getElementById("future")?.textContent).toBe("9");
  });
});
