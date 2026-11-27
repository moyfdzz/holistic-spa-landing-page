/**
 * The gate of the admin area. It decides, for every request to `/admin` and `/api/admin`,
 * whether to let it through or answer instead. It fails closed: anything unexpected is a
 * refusal. The Clerk calls are injected, so the rules can be tested without Clerk.
 * @module server/admin/guard
 */
import { isAdminEmail } from "./allowlist.js";
import { clearedCookies, signedOutResponse } from "./sign-out.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SIGN_OUT_PATH = "/api/admin/sign-out";

/**
 * @typedef {object} AuthState
 * @property {"signed-in" | "signed-out" | "handshake"} status - What Clerk found.
 * @property {Headers} headers - Headers Clerk wants on the answer: a handshake redirect, or cookies to set or remove.
 * @property {() => { userId: string | null, sessionId: string | null }} toAuth - The session, if any.
 */

/**
 * @typedef {object} GuardDeps
 * @property {(request: Request) => Promise<AuthState>} authenticate - Asks Clerk about the request.
 * @property {(returnUrl: string) => string} signInUrl - Where to send a visitor who is signed out.
 * @property {(userId: string) => Promise<string | null>} getVerifiedEmail - The verified primary email of a user.
 * @property {(sessionId: string) => Promise<boolean>} isSessionActive - Whether Clerk still holds the session open. A token stays valid until it expires, even after signing out.
 * @property {string[]} allowedEmails - The allowlist.
 * @property {(request: Request) => Promise<{ userId: string, sessionId: string } | null>} [readExpiredSession] - The session of a token that has just expired (Clerk tokens last about a minute and cannot be renewed on a POST), so signing out can still end it.
 */

/**
 * @typedef {{ allow: true, userId: string, sessionId: string | null, cookies: string[] } | { allow: false, response: Response }} GuardResult
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
 * The page a signed-in visitor sees when their account is not allowed. It explains the refusal
 * and offers to sign out, so they can come back with another account.
 * @returns {Response} The 403 page.
 */
function forbiddenPage() {
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Sin acceso · Administración</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1rem; background: #f6f2ea; color: #2b2b2b; font-family: system-ui, sans-serif; }
      main { max-width: 28rem; }
      h1 { font-size: 1.5rem; margin: 0 0 0.75rem; }
      p { line-height: 1.5; margin: 0 0 1.25rem; }
      button { min-height: 44px; padding: 0 1.25rem; border: 1px solid #4a5d44; border-radius: 999px; background: #4a5d44; color: #fff; font: inherit; cursor: pointer; }
      button:focus-visible { outline: 3px solid #1a56db; outline-offset: 2px; }
    </style>
  </head>
  <body>
    <main>
      <h1>Esta cuenta no tiene acceso</h1>
      <p>Iniciaste sesión, pero esta cuenta no está autorizada para la administración. Cierra la sesión para entrar con otra cuenta.</p>
      <form method="post" action="/api/admin/sign-out">
        <button type="submit">Cerrar sesión</button>
      </form>
    </main>
  </body>
</html>`;
  return new Response(html, {
    status: 403,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/**
 * Adds cookies to an answer.
 * @param {Response} response - A response built here.
 * @param {string[]} cookies - `Set-Cookie` lines.
 * @returns {Response} The same response.
 */
function withCookies(response, cookies) {
  for (const line of cookies) response.headers.append("Set-Cookie", line);
  return response;
}

/**
 * Answers a visitor who has no session: the API says so, a page goes to sign in.
 * @param {Request} request - The request.
 * @param {GuardDeps} deps - What the guard needs from outside.
 * @param {boolean} api - True for `/api/admin`.
 * @returns {Response} The refusal.
 */
function askToSignIn(request, deps, api) {
  if (api) return refuse(401, "Unauthorized", true);
  return new Response(null, {
    status: 302,
    headers: { Location: deps.signInUrl(request.url) },
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

  // Any signed-in account may end its own session, allowed or not. Clerk's cookies are not
  // passed on here: they could give back the session that is being closed.
  if (request.method === "POST" && url.pathname === SIGN_OUT_PATH) {
    if (auth?.userId) {
      const { userId, sessionId } = auth;
      return { allow: true, userId, sessionId, cookies: [] };
    }
    // Signing out must work even when the short-lived token has expired: end the session if
    // it can be read, and clear the cookies in any case.
    /** @type {{ userId: string, sessionId: string } | null} */
    let expired = null;
    try {
      expired = (await deps.readExpiredSession?.(request)) ?? null;
    } catch {
      expired = null;
    }
    if (expired) return { allow: true, ...expired, cookies: [] };
    return { allow: false, response: signedOutResponse(request) };
  }

  // Without a redirect (as in production), this is the only way these cookies reach the browser.
  const cookies = state.headers.getSetCookie();
  /**
   * @param {Response} response - A refusal.
   * @returns {GuardResult} The refusal, carrying Clerk's cookies.
   */
  const deny = (response) =>
    /** @type {const} */ ({
      allow: false,
      response: withCookies(response, cookies),
    });

  if (!auth?.userId) return deny(askToSignIn(request, deps, api));

  let active = false;
  let email = null;
  try {
    active = !!auth.sessionId && (await deps.isSessionActive(auth.sessionId));
    if (active) email = await deps.getVerifiedEmail(auth.userId);
  } catch {
    return deny(refuse(401, "Unauthorized", api));
  }
  if (!active) {
    return {
      allow: false,
      response: withCookies(
        askToSignIn(request, deps, api),
        clearedCookies(request),
      ),
    };
  }
  if (!isAdminEmail(deps.allowedEmails, email)) {
    return deny(api ? refuse(403, "Forbidden", true) : forbiddenPage());
  }
  const { userId, sessionId } = auth;
  return { allow: true, userId, sessionId, cookies };
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
