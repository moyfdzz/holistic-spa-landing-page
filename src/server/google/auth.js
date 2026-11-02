/**
 * Signs in to Google as a service account: a JWT signed with its private key is exchanged for a
 * short-lived access token. Uses the Web Crypto API of the Worker, so it needs no library.
 * Nothing here logs or returns the key or the token except `getAccessToken`, which returns the
 * token to its caller and nowhere else.
 * @module server/google/auth
 */
import { SafeError, safeWord } from "../errors.js";
import { z } from "zod";

/** The only address the signed request is sent to, whatever the key file says. */
export const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Read-only access to Search Console. */
export const SEARCH_CONSOLE_SCOPE =
  "https://www.googleapis.com/auth/webmasters.readonly";

const serviceAccountSchema = z.object({
  client_email: z.string().regex(/^[^@\s]+@[^@\s]+$/),
  private_key: z.string().startsWith("-----BEGIN PRIVATE KEY-----"),
});

/** @typedef {z.infer<typeof serviceAccountSchema>} ServiceAccount */

/**
 * Reads the JSON of a service account key.
 * @param {string} json - The content of the key file.
 * @returns {ServiceAccount} The two fields the code needs.
 * @throws {Error} With what is wrong and never with a value of the file.
 */
export function parseServiceAccount(json) {
  /** @type {unknown} */
  let data;
  try {
    data = JSON.parse(json);
  } catch {
    throw new SafeError("The service account key is not valid JSON");
  }
  const result = serviceAccountSchema.safeParse(data);
  if (!result.success) {
    const names = [
      ...new Set(result.error.issues.map((issue) => String(issue.path[0]))),
    ];
    throw new SafeError(
      `The service account key has wrong or missing fields: ${names.join(", ")}`,
    );
  }
  return result.data;
}

/**
 * Writes bytes or text as base64url, as a JWT needs.
 * @param {ArrayBuffer | string} input - What to write.
 * @returns {string} The base64url text, without padding.
 */
export function base64url(input) {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/**
 * Turns a PEM private key into the bytes Web Crypto imports.
 * @param {string} pem - The `-----BEGIN PRIVATE KEY-----` text.
 * @returns {Uint8Array<ArrayBuffer>} The DER bytes.
 */
function pemToBytes(pem) {
  const body = pem
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(body);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1)
    bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/**
 * Builds the signed JWT that asks for a token.
 * @param {ServiceAccount} account - The service account.
 * @param {string} scope - What the token may do.
 * @param {number} nowSeconds - The current time, in seconds since 1970.
 * @returns {Promise<string>} The `header.claims.signature` text.
 */
export async function createSignedJwt(account, scope, nowSeconds) {
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: account.client_email,
      scope,
      aud: TOKEN_URL,
      iat: nowSeconds,
      exp: nowSeconds + 3600,
    }),
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(account.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  return `${header}.${claims}.${base64url(signature)}`;
}

/**
 * Gets an access token for the service account.
 * @param {ServiceAccount} account - The service account.
 * @param {string} scope - What the token may do.
 * @param {typeof fetch} fetchFn - `fetch`, or a fake in tests.
 * @param {Date} now - The current time.
 * @returns {Promise<string>} The access token. Never log it.
 * @throws {Error} When Google refuses, with the status and Google's error code but not the body.
 */
export async function getAccessToken(account, scope, fetchFn, now) {
  const assertion = await createSignedJwt(
    account,
    scope,
    Math.floor(now.getTime() / 1000),
  );
  const response = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  /** @type {{ access_token?: unknown, error?: unknown }} */
  const data = await response.json().catch(() => ({}));
  if (!response.ok || typeof data.access_token !== "string") {
    const code = safeWord(data.error);
    throw new SafeError(
      `Google refused the service account sign-in (${response.status}, ${code})`,
    );
  }
  return data.access_token;
}
