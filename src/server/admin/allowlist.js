/**
 * Who may open `/admin`: a list of emails kept in the `ADMIN_EMAILS` secret of the Worker.
 * @module server/admin/allowlist
 */

/**
 * Turns the secret into a clean list.
 * @param {string | undefined} value - The secret: emails separated by commas.
 * @returns {string[]} The emails in lowercase, without blanks or repeats.
 */
export function parseAdminEmails(value) {
  const emails = (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.includes("@"));
  return [...new Set(emails)];
}

/**
 * Tells whether an email may open the admin area. An empty list lets nobody in.
 * @param {string[]} allowed - The list from `parseAdminEmails`.
 * @param {string | null | undefined} email - The verified email of the signed-in user.
 * @returns {boolean} True when the email is in the list.
 */
export function isAdminEmail(allowed, email) {
  if (!email) return false;
  return allowed.includes(email.trim().toLowerCase());
}
