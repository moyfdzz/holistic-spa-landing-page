import { describe, expect, it } from "vitest";
import {
  adminSecurityHeaders,
  guardAdminRequest,
  isSameOrigin,
} from "./guard.js";

/**
 * Builds the dependencies with fakes.
 * @param {object} [options] - What the fake Clerk answers.
 * @param {"signed-in" | "signed-out" | "handshake"} [options.status] - Session status.
 * @param {string | null} [options.email] - Verified email of the user.
 * @param {boolean} [options.throws] - Make the authentication fail.
 * @returns {import("./guard.js").GuardDeps} The dependencies.
 */
function deps({
  status = "signed-in",
  email = "dueno@example.com",
  throws = false,
} = {}) {
  return {
    allowedEmails: ["dueno@example.com"],
    signInUrl: (returnUrl) =>
      `https://accounts.example.dev/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`,
    getVerifiedEmail: async () => email,
    authenticate: async () => {
      if (throws) throw new Error("clerk down");
      const headers = new Headers();
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
    const anonymous = await guardAdminRequest(
      signOut({ origin: "https://www.example.com" }),
      deps({ status: "signed-out" }),
    );
    if (anonymous.allow) throw new Error("must not allow");
    expect(anonymous.response.status).toBe(401);
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
