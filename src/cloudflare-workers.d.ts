// Types for the module that the Cloudflare runtime provides to the Worker. Only what the site uses.
declare module "cloudflare:workers" {
  /** Variables, secrets and bindings of the Worker. */
  export const env: Record<string, unknown>;
}
