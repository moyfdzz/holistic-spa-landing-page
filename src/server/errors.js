/**
 * Safe descriptions of errors for logs. Messages of database and network errors can contain
 * host names, user names or parts of a connection string, so only the class, the Postgres or
 * network `code` and our own environment message (which names variables, never values) are kept.
 * @module server/errors
 */

/**
 * Describes an error without leaking anything sensitive.
 * @param {unknown} error - Whatever was thrown.
 * @returns {string} For example `NeonDbError (28P01)` or `Error: Invalid server environment: DATABASE_URL`.
 */
export function describeError(error) {
  if (!(error instanceof Error)) return "non-error value thrown";
  if (error.message.startsWith("Invalid server environment:")) {
    return `Error: ${error.message}`;
  }
  const code = /** @type {{ code?: unknown }} */ (error).code;
  return typeof code === "string" ? `${error.name} (${code})` : error.name;
}
