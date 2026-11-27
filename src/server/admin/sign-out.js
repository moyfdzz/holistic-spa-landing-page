/**
 * What ending an admin session looks like: the cookies Clerk sets are cleared and the visitor
 * goes to the home page. Shared by the sign-out route and the guard, which answers the same
 * way when the session token has already expired.
 * @module server/admin/sign-out
 */
import { describeError } from "../errors.js";

/** Cookies Clerk sets on this site, cleared even when the request did not bring them. */
const BASE_COOKIES = ["__session", "__client_uat", "__clerk_db_jwt"];

/**
 * Any cookie of Clerk. It also sets copies with a suffix made from the publishable key
 * (`__session_Ab12Cd34`), a refresh cookie and the handshake cookies.
 */
const CLERK_COOKIE = /^__(session|client_uat|refresh|clerk)[\w-]*$/;

/** The session token, under its plain name or the suffixed one. */
const SESSION_COOKIE = /^__session(_[\w-]+)?$/;

/**
 * Splits the `Cookie` header.
 * @param {Request} request - The request.
 * @returns {{ name: string, value: string }[]} Its cookies.
 */
function readCookies(request) {
  return (request.headers.get("cookie") ?? "").split(";").map((part) => {
    const [name, ...rest] = part.split("=");
    return { name: name.trim(), value: rest.join("=").trim() };
  });
}

/**
 * Builds the `Set-Cookie` lines that remove every Clerk cookie from the browser.
 * @param {Request} request - The request, which tells the cookie names and the domain.
 * @returns {string[]} The lines.
 */
export function clearedCookies(request) {
  const names = new Set(BASE_COOKIES);
  for (const { name } of readCookies(request)) {
    if (CLERK_COOKIE.test(name)) names.add(name);
  }
  // A browser removes a cookie only when the domain matches too, and Clerk sets some for the
  // whole site (`example.com`) and others for this host only. Local addresses and IP
  // addresses (a last label that does not start with a letter) take no domain.
  const site = new URL(request.url).hostname.replace(/^www\./, "");
  const domains = /\.[a-z][a-z0-9-]*$/i.test(site)
    ? ["", `; Domain=${site}`]
    : [""];
  return [...names].flatMap((name) =>
    domains.map(
      (domain) => `${name}=; Path=/; Max-Age=0; Secure; SameSite=Lax${domain}`,
    ),
  );
}

/**
 * Builds the answer that ends a session on this site.
 * @param {Request} request - The request.
 * @returns {Response} A redirect to the home page that expires the Clerk cookies.
 */
export function signedOutResponse(request) {
  const headers = new Headers({ Location: "/" });
  for (const line of clearedCookies(request)) {
    headers.append("Set-Cookie", line);
  }
  return new Response(null, { status: 303, headers });
}

/**
 * Reads every session token of a request, since Clerk may use either name.
 * @param {Request} request - The request.
 * @returns {string[]} The tokens, without repeats.
 */
export function readSessionTokens(request) {
  const tokens = readCookies(request)
    .filter(({ name, value }) => SESSION_COOKIE.test(name) && value)
    .map(({ value }) => value);
  return [...new Set(tokens)];
}

/**
 * Ends a session at Clerk.
 * @param {{ revokeSession: (id: string) => Promise<unknown>, getSession: (id: string) => Promise<{ status: string }> }} sessions - The sessions of the Clerk client.
 * @param {string} sessionId - The session to end.
 * @returns {Promise<boolean>} False when it may still be open.
 */
export async function endSession(sessions, sessionId) {
  try {
    await sessions.revokeSession(sessionId);
    return true;
  } catch (error) {
    console.error("sign-out could not revoke:", describeError(error));
  }
  // A session that had already ended cannot be revoked again, and that is fine.
  try {
    return (await sessions.getSession(sessionId)).status !== "active";
  } catch {
    return false;
  }
}

/**
 * What the visitor sees when Clerk could not end the session. The cookies stay, so trying
 * again can still tell which session to end.
 * @returns {Response} A page with a button to try again.
 */
export function signOutFailedResponse() {
  const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>No se cerró la sesión · Administración</title>
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
      <h1>No se cerró la sesión</h1>
      <p>Tu sesión puede seguir abierta. Inténtalo de nuevo en un momento.</p>
      <form method="post" action="/api/admin/sign-out">
        <button type="submit">Cerrar sesión</button>
      </form>
    </main>
  </body>
</html>`;
  return new Response(html, {
    status: 502,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
