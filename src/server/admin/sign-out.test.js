import { afterEach, describe, expect, it, vi } from "vitest";
import {
  endSession,
  readSessionTokens,
  signedOutResponse,
  signOutFailedResponse,
} from "./sign-out.js";

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it("names the domain of a site whose name ends in a number", () => {
    expect(
      cleared("https://www.spa24.com/x").some((c) =>
        c.endsWith("; Domain=spa24.com"),
      ),
    ).toBe(true);
  });
});

describe("endSession", () => {
  const down = async () => {
    throw new Error("clerk down");
  };

  it("is done when Clerk revokes the session", async () => {
    const sessions = { revokeSession: async () => {}, getSession: down };
    expect(await endSession(sessions, "sess_1")).toBe(true);
  });

  it("is done when the session had already ended", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const sessions = {
      revokeSession: down,
      getSession: async () => ({ status: "revoked" }),
    };
    expect(await endSession(sessions, "sess_1")).toBe(true);
  });

  it("is not done while the session is open, or when Clerk cannot tell", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    for (const getSession of [async () => ({ status: "active" }), down]) {
      const sessions = { revokeSession: down, getSession };
      expect(await endSession(sessions, "sess_1")).toBe(false);
    }
  });
});

describe("signOutFailedResponse", () => {
  it("says so, offers to try again and keeps the cookies", async () => {
    const response = signOutFailedResponse();
    expect(response.status).toBe(502);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(await response.text()).toContain('action="/api/admin/sign-out"');
  });
});

describe("readSessionTokens", () => {
  /**
   * @param {string} cookie - The Cookie header.
   * @returns {string[]} The tokens found in it.
   */
  const tokens = (cookie) =>
    readSessionTokens(
      new Request("https://www.example.com/", {
        headers: cookie ? { cookie } : {},
      }),
    );

  it("reads the plain and the suffixed cookie, once each value", () => {
    expect(
      tokens("a=1; __session=abc; __session_Ab-1_d34=def; __session_x=abc"),
    ).toEqual(["abc", "def"]);
  });

  it("keeps an equals sign inside the value", () => {
    expect(tokens("__session=a=b")).toEqual(["a=b"]);
  });

  it("finds nothing when the cookie is missing, empty or another one", () => {
    for (const cookie of ["", "a=1", "__session=", "x__session=1"]) {
      expect(tokens(cookie)).toEqual([]);
    }
  });
});
