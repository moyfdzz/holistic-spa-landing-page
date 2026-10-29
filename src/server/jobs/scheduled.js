/**
 * Entry of the Cloudflare Cron Trigger: one handler that runs every scheduled job.
 * @module server/jobs/scheduled
 */
import { runDailyJob } from "../analytics/jobs.js";
import { createDb } from "../db/client.js";
import { describeError } from "../errors.js";
import { parseServerEnv } from "../env.js";

/**
 * Runs the scheduled jobs. Logs counts only, never data.
 * @param {{ scheduledTime?: number, cron?: string }} controller - What Cloudflare passes.
 * @param {Record<string, unknown>} env - The bindings of the Worker.
 * @returns {Promise<void>}
 */
export async function runScheduled(controller, env) {
  const now = new Date(controller.scheduledTime ?? Date.now());
  try {
    const db = createDb(parseServerEnv(env).DATABASE_URL);
    const summary = await runDailyJob(db, now);
    console.log("daily job finished:", JSON.stringify(summary));
  } catch (error) {
    console.error("daily job failed:", describeError(error));
    // Let Cloudflare record the run as failed.
    throw error;
  }
}
