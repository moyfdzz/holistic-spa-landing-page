/**
 * The gate of the admin area. It decides, for every request to `/admin` and `/api/admin`,
 * whether to let it through or answer instead. It fails closed: anything unexpected is a
 * refusal. The Clerk calls are injected, so the rules can be tested without Clerk.
 * @module server/admin/guard
 */
import { isAdminEmail } from "./allowlist.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * @typedef {object} AuthState
 * @property {"signed-in" | "signed-out" | "handshake"} status - What Clerk found.
 * @property {Headers} headers - Headers Clerk wants on the answer (a handshake redirect).
 * @property {() => { userId: string | null, sessionId: string | null }} toAuth - The session, if any.
 */

/**
 * @typedef {object} GuardDeps
 * @property {(request: Request) => Promise<AuthState>} authenticate - Asks Clerk about the request.
 * @property {(returnUrl: string) => string} signInUrl - Where to send a visitor who is signed out.
 * @property {(userId: string) => Promise<string | null>} getVerifiedEmail - The verified primary email of a user.
 * @property {string[]} allowedEmails - The allowlist.
 */

/**
 * @typedef {{ allow: true, userId: string, sessionId: string | null } | { allow: false, response: Response }} GuardResult
 */

/**
 * Tells whether a request comes from this same site (needed for anything that changes data).
 * @param {Request} request - The request.
 * @returns {boolean} True when `Origin` is this host. A missing `Origin` on a change is refused.
 */
export function isSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

/**
 * Answers with a plain text page or JSON.
 * @param {number} status - HTTP status.
 * @param {string} message - Short message, without details.
 * @param {boolean} api - True for `/api/admin`, which answers JSON.
 * @returns {Response} The response.
 */
function refuse(status, message, api) {
  return api
    ? new Response(JSON.stringify({ error: message }), {
        status,
        headers: { "Content-Type": "application/json" },
      })
    : new Response(message, {
        status,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
}

/**
 * Decides what to do with a request to the admin area.
 * @param {Request} request - The request.
 * @param {GuardDeps} deps - What the guard needs from outside.
 * @returns {Promise<GuardResult>} Let it through, or the response to send instead.
 */
export async function guardAdminRequest(request, deps) {
  const url = new URL(request.url);
  const api = url.pathname.startsWith("/api/");

  // Anything that changes data must come from this same site.
  if (!SAFE_METHODS.has(request.method) && !isSameOrigin(request)) {
    return { allow: false, response: refuse(403, "Forbidden", api) };
  }

  /** @type {AuthState} */
  let state;
  try {
    state = await deps.authenticate(request);
  } catch {
    return { allow: false, response: refuse(401, "Unauthorized", api) };
  }

  // Clerk may need a redirect (a handshake) to read or refresh the session.
  const location = state.headers.get("location");
  if (location && !api) {
    return {
      allow: false,
      response: new Response(null, { status: 307, headers: state.headers }),
    };
  }

  const auth = state.status === "signed-in" ? state.toAuth() : null;
  if (!auth?.userId) {
    if (api)
      return { allow: false, response: refuse(401, "Unauthorized", true) };
    return {
      allow: false,
      response: new Response(null, {
        status: 302,
        headers: { Location: deps.signInUrl(request.url) },
      }),
    };
  }

  let email = null;
  try {
    email = await deps.getVerifiedEmail(auth.userId);
  } catch {
    return { allow: false, response: refuse(401, "Unauthorized", api) };
  }
  if (!isAdminEmail(deps.allowedEmails, email)) {
    return { allow: false, response: refuse(403, "Forbidden", api) };
  }
  return { allow: true, userId: auth.userId, sessionId: auth.sessionId };
}

/**
 * Headers every admin response gets: nothing is indexed, cached or framed, and scripts come
 * only from this site (the admin pages do not load Clerk's scripts at all).
 * @returns {Record<string, string>} The headers.
 */
export function adminSecurityHeaders() {
  return {
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "private, no-store",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "same-origin",
  };
}
