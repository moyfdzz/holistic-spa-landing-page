import { describe, expect, it } from "vitest";
import { readCookie, signedOutResponse } from "./sign-out.js";

describe("signedOutResponse", () => {
  /**
   * @param {string} url - Where the request goes.
   * @param {string} [cookie] - The Cookie header.
   * @returns {string[]} The cookies of the answer.
   */
  const cleared = (url, cookie) =>
    signedOutResponse(
      new Request(url, { headers: cookie ? { cookie } : {} }),
    ).headers.getSetCookie();

  it("goes to the home page and expires the Clerk cookies", () => {
    const response = signedOutResponse(
      new Request("https://www.example.com/api/admin/sign-out"),
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("/");
    const cookies = response.headers.getSetCookie();
    for (const name of ["__session", "__client_uat", "__clerk_db_jwt"]) {
      expect(cookies.some((c) => c.startsWith(`${name}=;`))).toBe(true);
    }
    expect(cookies.every((c) => c.includes("Max-Age=0"))).toBe(true);
  });

  it("expires every Clerk cookie the browser sent, and no other", () => {
    const cookies = cleared(
      "https://www.example.com/api/admin/sign-out",
      "__session_Ab-1_d34=x; __refresh_Ab-1_d34=y; __clerk_handshake=z; theme=dark; __cf_bm=1",
    );
    for (const name of [
      "__session_Ab-1_d34",
      "__refresh_Ab-1_d34",
      "__clerk_handshake",
    ]) {
      expect(cookies.some((c) => c.startsWith(`${name}=;`))).toBe(true);
    }
    expect(cookies.some((c) => /^(theme|__cf_bm)=/.test(c))).toBe(false);
  });

  it("expires each cookie for this host and for the whole site", () => {
    const session = cleared("https://www.example.com/x").filter((c) =>
      c.startsWith("__session=;"),
    );
    expect(session).toHaveLength(2);
    expect(session.filter((c) => c.includes("Domain="))).toEqual([
      expect.stringContaining("; Domain=example.com"),
    ]);
  });

  it("names no domain on a local address", () => {
    for (const url of ["http://localhost:4321/x", "http://127.0.0.1:4321/x"]) {
      expect(cleared(url).some((c) => c.includes("Domain="))).toBe(false);
    }
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
