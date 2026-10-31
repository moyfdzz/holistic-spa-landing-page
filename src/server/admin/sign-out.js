/**
 * What ending an admin session looks like: the cookies Clerk sets are cleared and the visitor
 * goes to the home page. Shared by the sign-out route and the guard, which answers the same
 * way when the session token has already expired.
 * @module server/admin/sign-out
 */

/** Cookies Clerk sets on this site. */
const SESSION_COOKIES = ["__session", "__client_uat", "__clerk_db_jwt"];

/**
 * Builds the answer that ends a session on this site.
 * @returns {Response} A redirect to the home page that expires the Clerk cookies.
 */
export function signedOutResponse() {
  const expired = "Path=/; Max-Age=0; Secure; SameSite=Lax";
  const headers = new Headers({ Location: "/" });
  for (const name of SESSION_COOKIES) {
    headers.append("Set-Cookie", `${name}=; ${expired}`);
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
