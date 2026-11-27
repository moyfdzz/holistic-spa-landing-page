/**
 * What ending an admin session looks like: the cookies Clerk sets are cleared and the visitor
 * goes to the home page. Shared by the sign-out route and the guard, which answers the same
 * way when the session token has already expired.
 * @module server/admin/sign-out
 */

/** Cookies Clerk sets on this site, cleared even when the request did not bring them. */
const BASE_COOKIES = ["__session", "__client_uat", "__clerk_db_jwt"];

/**
 * Any cookie of Clerk. It also sets copies with a suffix made from the publishable key
 * (`__session_Ab12Cd34`), a refresh cookie and the handshake cookies.
 */
const CLERK_COOKIE = /^__(session|client_uat|refresh|clerk)[\w-]*$/;

/**
 * Builds the `Set-Cookie` lines that remove every Clerk cookie from the browser.
 * @param {Request} request - The request, which tells the cookie names and the domain.
 * @returns {string[]} The lines.
 */
export function clearedCookies(request) {
  const names = new Set(BASE_COOKIES);
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const name = part.split("=")[0].trim();
    if (CLERK_COOKIE.test(name)) names.add(name);
  }
  // A browser removes a cookie only when the domain matches too, and Clerk sets some for the
  // whole site (`example.com`) and others for this host only.
  const site = new URL(request.url).hostname.replace(/^www\./, "");
  const domains = /[a-z]\.[a-z]/i.test(site) ? ["", `; Domain=${site}`] : [""];
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
 * Reads one cookie of a request.
 * @param {Request} request - The request.
 * @param {string} name - Cookie name.
 * @returns {string | null} The value, or null when it is not there.
 */
export function readCookie(request, name) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    if (part.slice(0, index).trim() === name) {
      return part.slice(index + 1).trim() || null;
    }
  }
  return null;
}
