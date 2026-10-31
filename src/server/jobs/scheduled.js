/**
 * Entry of the Cloudflare Cron Trigger: one handler that runs every scheduled job.
 * @module server/jobs/scheduled
 */
import { runDailyJob } from "../analytics/jobs.js";
import { createDb } from "../db/client.js";
import { describeError } from "../errors.js";
import { parseServerEnv } from "../env.js";
import { readSearchConsoleConfig } from "../google/config.js";
import { runSearchConsoleImport } from "../google/import.js";

/**
 * Runs the scheduled jobs. Logs counts only, never data. Each job runs even if another failed
 * (the daily job deletes what must not be kept, and must not wait for Google); the run is
 * marked as failed if any of them failed.
 * @param {{ scheduledTime?: number, cron?: string }} controller - What Cloudflare passes.
 * @param {Record<string, unknown>} env - The bindings of the Worker.
 * @returns {Promise<void>}
 */
export async function runScheduled(controller, env) {
  const now = new Date(controller.scheduledTime ?? Date.now());
  /** @type {unknown[]} */
  const failures = [];

  /** @type {ReturnType<typeof createDb> | null} */
  let db = null;
  try {
    db = createDb(parseServerEnv(env).DATABASE_URL);
    const summary = await runDailyJob(db, now);
    console.log("daily job finished:", JSON.stringify(summary));
  } catch (error) {
    console.error("daily job failed:", describeError(error));
    failures.push(error);
  }

  try {
    if (!db) throw new Error("no database to import into");
    const summary = await runSearchConsoleImport({
      db,
      config: readSearchConsoleConfig(env),
      now,
    });
    console.log("search console import finished:", JSON.stringify(summary));
  } catch (error) {
    console.error("search console import failed:", describeError(error));
    failures.push(error);
  }

  // Let Cloudflare record the run as failed.
  if (failures.length > 0) throw failures[0];
}
