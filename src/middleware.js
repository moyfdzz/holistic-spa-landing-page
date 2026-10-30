/**
 * Runs for every request that reaches the Worker. Public pages are served as static files and
 * never get here; only `/admin` and `/api/admin` are guarded, and everything else passes.
 */
import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import {
  adminSecurityHeaders,
  guardAdminRequest,
} from "./server/admin/guard.js";
import { createAdminDeps, readAdminConfig } from "./server/admin/clerk.js";
import { describeError } from "./server/errors.js";

/**
 * Tells whether a path belongs to the admin area.
 * @param {string} pathname - The path of the request.
 * @returns {boolean} True for `/admin`, `/api/admin` and what is under them.
 */
function isAdminPath(pathname) {
  return /^\/(api\/)?admin(\/|$)/.test(pathname);
}

/**
 * Adds the admin security headers to a response.
 * @param {Response} response - The response.
 * @returns {Response} The same response with the headers.
 */
function withAdminHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(adminSecurityHeaders())) {
    headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);
  if (!isAdminPath(pathname)) return next();

  const read = readAdminConfig({
    secretKey: /** @type {string | undefined} */ (env.CLERK_SECRET_KEY),
    publishableKey: import.meta.env.PUBLIC_CLERK_PUBLISHABLE_KEY,
    adminEmails: /** @type {string | undefined} */ (env.ADMIN_EMAILS),
  });
  if (!read.ok) {
    console.error("admin is not configured, missing:", read.missing.join(", "));
    return withAdminHeaders(
      new Response("Service unavailable", { status: 503 }),
    );
  }

  try {
    const deps = createAdminDeps(read.config);
    const result = await guardAdminRequest(context.request, deps);
    if (!result.allow) return withAdminHeaders(result.response);
    context.locals.admin = {
      userId: result.userId,
      sessionId: result.sessionId,
    };
    context.locals.adminClerk = deps.clerk;
    return withAdminHeaders(await next());
  } catch (error) {
    console.error("admin guard failed:", describeError(error));
    return withAdminHeaders(new Response("Unauthorized", { status: 401 }));
  }
});
