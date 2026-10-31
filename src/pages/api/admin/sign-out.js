/**
 * POST /api/admin/sign-out: ends the Clerk session and clears its cookies. The middleware has
 * already checked that the request is from this same site. Any signed-in account may use it,
 * and so may a visitor whose token expired a moment ago (then the guard reads the session
 * from the expired token, or just clears the cookies).
 */
import { signedOutResponse } from "../../../server/admin/sign-out.js";

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
  return signedOutResponse();
}
