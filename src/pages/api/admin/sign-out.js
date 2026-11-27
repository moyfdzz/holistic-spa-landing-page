/**
 * POST /api/admin/sign-out: ends the Clerk session and clears its cookies. The middleware has
 * already checked that the request is from this same site. Any signed-in account may use it,
 * and so may a visitor whose token expired a moment ago (then the guard reads the session
 * from the expired token, or just clears the cookies).
 */
import {
  endSession,
  signedOutResponse,
  signOutFailedResponse,
} from "../../../server/admin/sign-out.js";

export const prerender = false;

/**
 * @param {{ locals: App.Locals, request: Request }} context - The Astro context.
 * @returns {Promise<Response>} A redirect to the home page, or a page to try again.
 */
export async function POST({ locals, request }) {
  const sessionId = locals.admin?.sessionId;
  const clerk = locals.adminClerk;
  if (sessionId && clerk && !(await endSession(clerk.sessions, sessionId))) {
    return signOutFailedResponse();
  }
  return signedOutResponse(request);
}
