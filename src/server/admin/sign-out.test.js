import { describe, expect, it } from "vitest";
import { readCookie, signedOutResponse } from "./sign-out.js";

describe("signedOutResponse", () => {
  it("goes to the home page and expires the Clerk cookies", () => {
    const response = signedOutResponse();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    const cookies = response.headers.getSetCookie();
    expect(cookies).toHaveLength(3);
    for (const name of ["__session", "__client_uat", "__clerk_db_jwt"]) {
      expect(cookies.some((c) => c.startsWith(`${name}=;`))).toBe(true);
    }
    expect(cookies.every((c) => c.includes("Max-Age=0"))).toBe(true);
  });
});

describe("readCookie", () => {
  /**
   * @param {string} cookie - The Cookie header.
   * @returns {Request} A request carrying it.
   */
  const request = (cookie) =>
    new Request("https://www.example.com/", {
      headers: cookie ? { cookie } : {},
    });

  it("finds a cookie among several", () => {
    expect(
      readCookie(request("a=1; __session=abc.def; b=2"), "__session"),
    ).toBe("abc.def");
  });

  it("keeps an equals sign inside the value", () => {
    expect(readCookie(request("__session=a=b"), "__session")).toBe("a=b");
  });

  it("answers null when the cookie is missing or empty", () => {
    expect(readCookie(request(""), "__session")).toBeNull();
    expect(readCookie(request("a=1"), "__session")).toBeNull();
    expect(readCookie(request("__session="), "__session")).toBeNull();
  });

  it("does not match a longer name", () => {
    expect(readCookie(request("x__session=1"), "__session")).toBeNull();
  });
});
