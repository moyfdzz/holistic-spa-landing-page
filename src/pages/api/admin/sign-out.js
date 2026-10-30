/**
 * POST /api/admin/sign-out: ends the Clerk session and clears its cookies. The middleware has
 * already checked that the request is from the owner and from this same site.
 */
export const prerender = false;

/**
 * @param {{ locals: App.Locals }} context - The Astro context.
 * @returns {Promise<Response>} A redirect to the home page.
 */
export async function POST({ locals }) {
  const sessionId = locals.admin?.sessionId;
  try {
    if (sessionId) await locals.adminClerk?.sessions.revokeSession(sessionId);
  } catch {
    // The cookies are cleared anyway; an expired session cannot be revoked twice.
  }
  const expired = "Path=/; Max-Age=0; Secure; SameSite=Lax";
  const headers = new Headers({ Location: "/" });
  for (const name of ["__session", "__client_uat", "__clerk_db_jwt"]) {
    headers.append("Set-Cookie", `${name}=; ${expired}`);
  }
  return new Response(null, { status: 303, headers });
}
