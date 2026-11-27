import { describe, expect, it } from "vitest";
import {
  adminSecurityHeaders,
  guardAdminRequest as guard,
  isAdminRequest,
  isSameOrigin,
  refuseUnguarded,
} from "./guard.js";

/**
 * Runs the guard with the path Astro would read from the request.
 * @param {Request} request - The request.
 * @param {import("./guard.js").GuardDeps} dependencies - What the guard needs.
 * @returns {ReturnType<typeof guard>} The result.
 */
const guardAdminRequest = (request, dependencies) =>
  guard(request, dependencies, new URL(request.url).pathname);

/**
 * Builds the dependencies with fakes.
 * @param {object} [options] - What the fake Clerk answers.
 * @param {"signed-in" | "signed-out" | "handshake"} [options.status] - Session status.
 * @param {string | null} [options.email] - Verified email of the user.
 * @param {boolean} [options.throws] - Make the authentication fail.
 * @param {boolean} [options.active] - Whether Clerk still holds the session open.
 * @param {string[]} [options.cookies] - Cookies Clerk asks to send to the browser.
 * @returns {import("./guard.js").GuardDeps} The dependencies.
 */
function deps({
  status = "signed-in",
  email = "dueno@example.com",
  throws = false,
  active = true,
  cookies = [],
} = {}) {
  return {
    allowedEmails: ["dueno@example.com"],
    signInUrl: (returnUrl) =>
      `https://accounts.example.dev/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`,
    getVerifiedEmail: async () => email,
    isSessionActive: async () => active,
    authenticate: async () => {
      if (throws) throw new Error("clerk down");
      const headers = new Headers();
      for (const cookie of cookies) headers.append("set-cookie", cookie);
      if (status === "handshake")
        headers.set("location", "https://clerk.example.dev/handshake");
      return {
        status,
        headers,
        toAuth: () => ({
          userId: status === "signed-in" ? "user_1" : null,
          sessionId: "sess_1",
        }),
      };
    },
  };
}

const page = (method = "GET", headers = {}) =>
  new Request("https://www.example.com/admin", { method, headers });
const api = (method = "GET", headers = {}) =>
  new Request("https://www.example.com/api/admin/thing", { method, headers });

describe("guardAdminRequest", () => {
  it("lets the owner in", async () => {
    const result = await guardAdminRequest(page(), deps());
    expect(result).toEqual({
      allow: true,
      userId: "user_1",
      sessionId: "sess_1",
      cookies: [],
    });
  });

  describe("a session that was closed", () => {
    const stale = () =>
      new Request("https://www.example.com/admin", {
        headers: { cookie: "__session_Ab12Cd34=token" },
      });

    it("does not open the door, even with a token that is still valid", async () => {
      const result = await guardAdminRequest(
        stale(),
        deps({ active: false, cookies: ["__session=back; Path=/"] }),
      );
      if (result.allow) throw new Error("must not allow");
      expect(result.response.status).toBe(302);
      const cookies = result.response.headers.getSetCookie();
      expect(cookies.some((c) => c.startsWith("__session_Ab12Cd34=;"))).toBe(
        true,
      );
      expect(cookies.every((c) => c.includes("Max-Age=0"))).toBe(true);
    });

    it("answers 401 to the API", async () => {
      const result = await guardAdminRequest(api(), deps({ active: false }));
      if (result.allow) throw new Error("must not allow");
      expect(result.response.status).toBe(401);
    });

    it("fails closed when Clerk cannot tell, or there is no session id", async () => {
      const unknown = {
        ...deps(),
        isSessionActive: async () => {
          throw new Error("clerk down");
        },
      };
      const noId = {
        ...deps(),
        authenticate: async () => ({
          status: /** @type {const} */ ("signed-in"),
          headers: new Headers(),
          toAuth: () => ({ userId: "user_1", sessionId: null }),
        }),
      };
      for (const dependencies of [unknown, noId]) {
        const result = await guardAdminRequest(page(), dependencies);
        expect(result.allow).toBe(false);
      }
    });
  });

  describe("cookies Clerk asks for", () => {
    const cookies = ["__session=new; Path=/", "__clerk_handshake=; Max-Age=0"];

    it("come back with a request that is let in", async () => {
      const result = await guardAdminRequest(page(), deps({ cookies }));
      if (!result.allow) throw new Error("must allow");
      expect(result.cookies).toEqual(cookies);
    });

    it("come back with a refusal", async () => {
      for (const options of [
        { status: /** @type {const} */ ("signed-out") },
        { email: "intruso@example.com" },
      ]) {
        const result = await guardAdminRequest(
          page(),
          deps({ ...options, cookies }),
        );
        if (result.allow) throw new Error("must not allow");
        expect(result.response.headers.getSetCookie()).toEqual(cookies);
      }
    });

    it("are left out of a sign-out, so the session does not come back", async () => {
      const request = new Request(
        "https://www.example.com/api/admin/sign-out",
        { method: "POST", headers: { origin: "https://www.example.com" } },
      );
      const signedIn = await guardAdminRequest(request, deps({ cookies }));
      if (!signedIn.allow) throw new Error("must allow");
      expect(signedIn.cookies).toEqual([]);
      const signedOut = await guardAdminRequest(
        request,
        deps({ status: "signed-out", cookies }),
      );
      if (signedOut.allow) throw new Error("must not allow");
      expect(
        signedOut.response.headers
          .getSetCookie()
          .every((c) => c.includes("Max-Age=0")),
      ).toBe(true);
    });
  });

  it("sends a visitor who is signed out to the sign-in page", async () => {
    const result = await guardAdminRequest(
      page(),
      deps({ status: "signed-out" }),
    );
    expect(result.allow).toBe(false);
    if (result.allow) return;
    expect(result.response.status).toBe(302);
    expect(result.response.headers.get("location")).toContain(
      "accounts.example.dev/sign-in",
    );
  });

  it("answers 401 JSON to the API when signed out", async () => {
    const result = await guardAdminRequest(
      api(),
      deps({ status: "signed-out" }),
    );
    if (result.allow) throw new Error("must not allow");
    expect(result.response.status).toBe(401);
    expect(result.response.headers.get("content-type")).toContain(
      "application/json",
    );
  });

  it("follows the redirect Clerk asks for (handshake)", async () => {
    const result = await guardAdminRequest(
      page(),
      deps({ status: "handshake" }),
    );
    if (result.allow) throw new Error("must not allow");
    expect(result.response.status).toBe(307);
    expect(result.response.headers.get("location")).toBe(
      "https://clerk.example.dev/handshake",
    );
  });

  it("refuses a signed-in user who is not in the allowlist", async () => {
    const result = await guardAdminRequest(
      page(),
      deps({ email: "intruso@example.com" }),
    );
    if (result.allow) throw new Error("must not allow");
    expect(result.response.status).toBe(403);
  });

  it("shows a page with a sign-out button to a signed-in user who is not allowed", async () => {
    const result = await guardAdminRequest(
      page(),
      deps({ email: "intruso@example.com" }),
    );
    if (result.allow) throw new Error("must not allow");
    expect(result.response.status).toBe(403);
    expect(result.response.headers.get("content-type")).toContain("text/html");
    const html = await result.response.text();
    expect(html).toContain('action="/api/admin/sign-out"');
    expect(html).not.toContain("intruso@example.com");
  });

  it("answers the API with 403 JSON for a user who is not allowed", async () => {
    const result = await guardAdminRequest(
      api(),
      deps({ email: "intruso@example.com" }),
    );
    if (result.allow) throw new Error("must not allow");
    expect(result.response.status).toBe(403);
    expect(result.response.headers.get("content-type")).toContain(
      "application/json",
    );
  });

  it("lets a signed-in user who is not allowed sign out, from this site only", async () => {
    const signOut = (headers = {}) =>
      new Request("https://www.example.com/api/admin/sign-out", {
        method: "POST",
        headers,
      });
    const notAllowed = deps({ email: "intruso@example.com" });
    const same = await guardAdminRequest(
      signOut({ origin: "https://www.example.com" }),
      notAllowed,
    );
    expect(same.allow).toBe(true);
    const cross = await guardAdminRequest(
      signOut({ origin: "https://evil.example" }),
      notAllowed,
    );
    expect(cross.allow).toBe(false);
  });

  describe("signing out with an expired token", () => {
    const signOut = (headers = { origin: "https://www.example.com" }) =>
      new Request("https://www.example.com/api/admin/sign-out", {
        method: "POST",
        headers,
      });

    it("ends the session found in the expired token", async () => {
      const result = await guardAdminRequest(signOut(), {
        ...deps({ status: "signed-out" }),
        readExpiredSession: async () => ({
          userId: "user_1",
          sessionId: "sess_1",
        }),
      });
      expect(result).toEqual({
        allow: true,
        userId: "user_1",
        sessionId: "sess_1",
        cookies: [],
      });
    });

    it("clears the cookies when the session cannot be read", async () => {
      for (const readExpiredSession of [
        undefined,
        async () => null,
        async () => {
          throw new Error("jwks down");
        },
      ]) {
        const result = await guardAdminRequest(signOut(), {
          ...deps({ status: "signed-out" }),
          readExpiredSession,
        });
        if (result.allow) throw new Error("must not allow");
        expect(result.response.status).toBe(303);
        expect(result.response.headers.get("location")).toBe("/");
        expect(
          result.response.headers
            .getSetCookie()
            .some((c) => c.startsWith("__session=;")),
        ).toBe(true);
      }
    });

    it("still refuses a sign-out from another site", async () => {
      const result = await guardAdminRequest(
        signOut({ origin: "https://evil.example" }),
        deps({ status: "signed-out" }),
      );
      if (result.allow) throw new Error("must not allow");
      expect(result.response.status).toBe(403);
    });

    it("does not use the expired token for any other route", async () => {
      let asked = false;
      const result = await guardAdminRequest(
        api("POST", { origin: "https://www.example.com" }),
        {
          ...deps({ status: "signed-out" }),
          readExpiredSession: async () => {
            asked = true;
            return { userId: "user_1", sessionId: "sess_1" };
          },
        },
      );
      if (result.allow) throw new Error("must not allow");
      expect(result.response.status).toBe(401);
      expect(asked).toBe(false);
    });
  });

  it("does not open other admin routes to a user who is not allowed", async () => {
    const result = await guardAdminRequest(
      new Request("https://www.example.com/api/admin/other", {
        method: "POST",
        headers: { origin: "https://www.example.com" },
      }),
      deps({ email: "intruso@example.com" }),
    );
    expect(result.allow).toBe(false);
  });

  it("refuses a user without a verified email", async () => {
    const result = await guardAdminRequest(page(), deps({ email: null }));
    if (result.allow) throw new Error("must not allow");
    expect(result.response.status).toBe(403);
  });

  it("fails closed when Clerk fails", async () => {
    const result = await guardAdminRequest(page(), deps({ throws: true }));
    if (result.allow) throw new Error("must not allow");
    expect(result.response.status).toBe(401);
  });

  it("refuses changes that do not come from the same site", async () => {
    for (const headers of [{}, { origin: "https://evil.example" }]) {
      const result = await guardAdminRequest(api("POST", headers), deps());
      if (result.allow) throw new Error("must not allow");
      expect(result.response.status).toBe(403);
    }
  });

  it("accepts a change from the same site", async () => {
    const result = await guardAdminRequest(
      api("POST", { origin: "https://www.example.com" }),
      deps(),
    );
    expect(result.allow).toBe(true);
  });
});

describe("a request written another way", () => {
  const signedOut = () => deps({ status: "signed-out" });

  it("is judged by the path Astro reads, not by the raw one", async () => {
    const result = await guard(
      new Request("https://www.example.com//api/admin/thing"),
      signedOut(),
      "/api/admin/thing",
    );
    if (result.allow) throw new Error("must not allow");
    expect(result.response.status).toBe(401);
    expect(result.response.headers.get("content-type")).toContain(
      "application/json",
    );
  });

  it("still lets any account sign out", async () => {
    const result = await guard(
      new Request("https://www.example.com/api//admin/sign-out", {
        method: "POST",
        headers: { origin: "https://www.example.com" },
      }),
      deps({ email: "intruso@example.com" }),
      "/api/admin/sign-out",
    );
    expect(result.allow).toBe(true);
  });
});

describe("isAdminRequest", () => {
  it("guards what is under /admin and /api/admin", () => {
    for (const pathname of [
      "/admin",
      "/admin/",
      "/admin/sitio",
      "/admin/no-such-page",
      "/api/admin/analytics",
    ]) {
      expect(isAdminRequest({ pathname, routePattern: "/404" }), pathname).toBe(
        true,
      );
    }
  });

  it("guards an admin route reached under another name", () => {
    expect(
      isAdminRequest({ pathname: "/admin.html", routePattern: "/admin" }),
    ).toBe(true);
  });

  it("leaves the public site alone", () => {
    for (const path of ["/", "/contact", "/administracion", "/api/health"]) {
      expect(isAdminRequest({ pathname: path, routePattern: path }), path).toBe(
        false,
      );
    }
  });
});

describe("refuseUnguarded", () => {
  it("answers nothing but a refusal when the guard did not run", async () => {
    const response = refuseUnguarded({});
    expect(response?.status).toBe(401);
    expect(response?.headers.get("cache-control")).toContain("no-store");
    expect(await response?.text()).toBe("Unauthorized");
  });

  it("lets through what the guard let in", () => {
    expect(
      refuseUnguarded({ admin: { userId: "user_1", sessionId: "sess_1" } }),
    ).toBeNull();
  });
});

describe("isSameOrigin", () => {
  it("compares the host of Origin with the host of the request", () => {
    expect(
      isSameOrigin(
        new Request("https://a.test/x", {
          headers: { origin: "https://a.test" },
        }),
      ),
    ).toBe(true);
    expect(
      isSameOrigin(
        new Request("https://a.test/x", {
          headers: { origin: "https://b.test" },
        }),
      ),
    ).toBe(false);
    expect(
      isSameOrigin(
        new Request("https://a.test/x", { headers: { origin: "not a url" } }),
      ),
    ).toBe(false);
  });
});

describe("adminSecurityHeaders", () => {
  it("blocks indexing, caching and framing, and allows scripts only from this site", () => {
    const headers = adminSecurityHeaders();
    expect(headers["X-Robots-Tag"]).toContain("noindex");
    expect(headers["Cache-Control"]).toContain("no-store");
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["Content-Security-Policy"]).toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    expect(headers["Content-Security-Policy"]).not.toMatch(/clerk/i);
  });
});
