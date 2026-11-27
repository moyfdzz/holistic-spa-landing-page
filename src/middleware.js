/**
 * Runs for every request that reaches the Worker. Public pages are served as static files and
 * never get here, except the 404 page; only `/admin` and `/api/admin` are guarded, and
 * everything else passes.
 */
import { env } from "cloudflare:workers";
import { defineMiddleware } from "astro:middleware";
import {
  adminSecurityHeaders,
  guardAdminRequest,
  isAdminRequest,
} from "./server/admin/guard.js";
import { createAdminDeps, readAdminConfig } from "./server/admin/clerk.js";
import { describeError } from "./server/errors.js";

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
  const target = {
    pathname: context.url.pathname,
    routePattern: context.routePattern,
  };
  if (!isAdminRequest(target)) return next();

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
    const result = await guardAdminRequest(context.request, deps, target);
    if (!result.allow) return withAdminHeaders(result.response);
    context.locals.admin = {
      userId: result.userId,
      sessionId: result.sessionId,
    };
    context.locals.adminClerk = deps.clerk;
    const response = withAdminHeaders(await next());
    for (const cookie of result.cookies) {
      response.headers.append("Set-Cookie", cookie);
    }
    return response;
  } catch (error) {
    console.error("admin guard failed:", describeError(error));
    return withAdminHeaders(new Response("Unauthorized", { status: 401 }));
  }
});
