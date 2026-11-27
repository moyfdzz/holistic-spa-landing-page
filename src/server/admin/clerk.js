/**
 * The real Clerk calls behind the admin guard. Only the backend package is used: Clerk's
 * browser scripts never load on this site, so the public pages stay free of them.
 * @module server/admin/clerk
 */
import { createClerkClient, verifyToken } from "@clerk/backend";
import { createRedirect } from "@clerk/backend/internal";
import { parseAdminEmails } from "./allowlist.js";
import { readCookie } from "./sign-out.js";

/**
 * @typedef {object} AdminConfig
 * @property {string} secretKey - `CLERK_SECRET_KEY`.
 * @property {string} publishableKey - `PUBLIC_CLERK_PUBLISHABLE_KEY`.
 * @property {string} adminEmails - `ADMIN_EMAILS`.
 */

/**
 * Checks that the three settings of the admin area exist, naming the missing ones only.
 * @param {Partial<AdminConfig>} config - What was found.
 * @returns {{ ok: true, config: AdminConfig } | { ok: false, missing: string[] }} The result.
 */
export function readAdminConfig(config) {
  const names = /** @type {const} */ ({
    secretKey: "CLERK_SECRET_KEY",
    publishableKey: "PUBLIC_CLERK_PUBLISHABLE_KEY",
    adminEmails: "ADMIN_EMAILS",
  });
  const missing = Object.entries(names)
    .filter(([key]) => !config[/** @type {keyof AdminConfig} */ (key)]?.trim())
    .map(([, name]) => name);
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, config: /** @type {AdminConfig} */ (config) };
}

/** Verified emails by user, kept a few minutes so each page does not call Clerk again. */
const emailCache = new Map();
const EMAIL_CACHE_MS = 5 * 60 * 1000;

/** How long after expiring a session token still identifies its session, for signing out. */
const EXPIRED_TOKEN_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Builds what the guard needs from Clerk.
 * @param {AdminConfig} config - The settings.
 * @returns {import("./guard.js").GuardDeps & { clerk: ReturnType<typeof createClerkClient> }} The dependencies.
 */
export function createAdminDeps(config) {
  const clerk = createClerkClient({
    secretKey: config.secretKey,
    publishableKey: config.publishableKey,
  });
  return {
    clerk,
    allowedEmails: parseAdminEmails(config.adminEmails),
    authenticate: (request) =>
      /** @type {Promise<import("./guard.js").AuthState>} */ (
        /** @type {unknown} */ (
          clerk.authenticateRequest(request, {
            publishableKey: config.publishableKey,
            secretKey: config.secretKey,
          })
        )
      ),
    async readExpiredSession(request) {
      const token = readCookie(request, "__session");
      if (!token) return null;
      try {
        // The signature is checked; only the expiry is relaxed.
        const payload = /** @type {{ sub?: string, sid?: string }} */ (
          /** @type {unknown} */ (
            await verifyToken(token, {
              secretKey: config.secretKey,
              clockSkewInMs: EXPIRED_TOKEN_GRACE_MS,
            })
          )
        );
        return payload?.sub && payload?.sid
          ? { userId: payload.sub, sessionId: payload.sid }
          : null;
      } catch {
        return null;
      }
    },
    signInUrl: (returnUrl) =>
      createRedirect({
        publishableKey: config.publishableKey,
        redirectAdapter: (url) => url,
        baseUrl: new URL(returnUrl).origin,
      }).redirectToSignIn({ returnBackUrl: returnUrl }),
    // Asked every time, never cached: signing out has to close the door at once.
    async isSessionActive(sessionId) {
      const session = await clerk.sessions.getSession(sessionId);
      return session.status === "active";
    },
    async getVerifiedEmail(userId) {
      const cached = emailCache.get(userId);
      if (cached && cached.until > Date.now()) return cached.email;
      const user = await clerk.users.getUser(userId);
      const primary = user.emailAddresses.find(
        (address) => address.id === user.primaryEmailAddressId,
      );
      const email =
        primary?.verification?.status === "verified"
          ? primary.emailAddress
          : null;
      emailCache.set(userId, { email, until: Date.now() + EMAIL_CACHE_MS });
      return email;
    },
  };
}
