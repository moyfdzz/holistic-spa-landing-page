// Types for the module that the Cloudflare runtime provides to the Worker. Only what the site uses.
declare module "cloudflare:workers" {
  /** Variables, secrets and bindings of the Worker. */
  export const env: Record<string, unknown>;
}

declare namespace App {
  interface Locals {
    /** Set by the middleware for signed-in admins. */
    admin?: { userId: string; sessionId: string | null };
    /** Clerk client of the request, for admin routes only. */
    adminClerk?: import("@clerk/backend").ClerkClient;
  }
}
