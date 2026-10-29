/**
 * Entry of the Worker. Astro answers the requests; the Cron Trigger runs the scheduled jobs.
 * `wrangler.jsonc` points `main` here.
 */
import { handle } from "@astrojs/cloudflare/handler";
import { runScheduled } from "./server/jobs/scheduled.js";

export default {
  fetch: handle,
  /**
   * @param {{ scheduledTime?: number, cron?: string }} controller - The schedule that fired.
   * @param {Record<string, unknown>} env - The bindings of the Worker.
   * @param {{ waitUntil: (promise: Promise<unknown>) => void }} context - The execution context.
   * @returns {void}
   */
  scheduled(controller, env, context) {
    context.waitUntil(runScheduled(controller, env));
  },
};
