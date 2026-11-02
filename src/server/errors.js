/**
 * Safe descriptions of errors for logs. Messages of database and network errors can contain
 * host names, user names or parts of a connection string, so only the class, the Postgres or
 * network `code`, our own environment message (which names variables, never values) and the
 * message of a `SafeError` are kept.
 * @module server/errors
 */

/**
 * An error whose message was written by us and holds nothing sensitive: a status, a short word
 * or the name of a setting, never a key, a token, a URL or a response body. It is the only kind
 * whose message `describeError` keeps.
 */
export class SafeError extends Error {
  /** @param {string} message - A message with nothing sensitive in it. */
  constructor(message) {
    super(message);
    this.name = "SafeError";
  }
}

/**
 * Keeps a word that comes from another service only when it looks like a status or an error code.
 * @param {unknown} value - What the service sent.
 * @returns {string} The word, or `unknown` when it is not a short code.
 */
export function safeWord(value) {
  return typeof value === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value)
    ? value
    : "unknown";
}

/**
 * Describes an error without leaking anything sensitive.
 * @param {unknown} error - Whatever was thrown.
 * @returns {string} For example `NeonDbError (28P01)` or `Error: Invalid server environment: DATABASE_URL`.
 */
export function describeError(error) {
  if (!(error instanceof Error)) return "non-error value thrown";
  if (error instanceof SafeError) return `${error.name}: ${error.message}`;
  if (error.message.startsWith("Invalid server environment:")) {
    return `Error: ${error.message}`;
  }
  const code = /** @type {{ code?: unknown }} */ (error).code;
  return typeof code === "string" ? `${error.name} (${code})` : error.name;
}
