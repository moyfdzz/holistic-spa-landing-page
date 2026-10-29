/**
 * Health check logic for `GET /api/health`. It reports only whether the service and the
 * database answer, never configuration, errors or secrets.
 * @module server/health
 */

/**
 * @typedef {object} HealthResult
 * @property {200 | 503} status - HTTP status to answer with.
 * @property {{ status: "ok" | "error", db: "ok" | "error", version: string }} body - JSON body.
 */

/**
 * Runs the health check.
 * @param {object} options - What the check needs.
 * @param {() => Promise<unknown>} options.ping - Runs a trivial query against the database; rejects when it cannot.
 * @param {string} options.version - Version of the site.
 * @param {(error: unknown) => void} [options.onError] - Called with the error when the check fails, so the caller can log it safely.
 * @returns {Promise<HealthResult>} The status and the body to send.
 */
export async function checkHealth({ ping, version, onError }) {
  try {
    await ping();
    return { status: 200, body: { status: "ok", db: "ok", version } };
  } catch (error) {
    onError?.(error);
    return { status: 503, body: { status: "error", db: "error", version } };
  }
}
