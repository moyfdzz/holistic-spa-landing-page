// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  base64url,
  createSignedJwt,
  getAccessToken,
  parseServiceAccount,
  SEARCH_CONSOLE_SCOPE,
  TOKEN_URL,
} from "./auth.js";

/** @type {CryptoKeyPair} */
let pair;
/** @type {string} */
let pem;

/**
 * Writes bytes as a PEM private key.
 * @param {ArrayBuffer} der - The PKCS8 bytes.
 * @returns {string} The PEM text.
 */
function toPem(der) {
  const body = btoa(String.fromCharCode(...new Uint8Array(der)));
  const lines = body.match(/.{1,64}/g) ?? [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

beforeAll(async () => {
  // A key made only for the tests: it is worth nothing and it is never written to disk.
  pair = /** @type {CryptoKeyPair} */ (
    await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    )
  );
  pem = toPem(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
});

/**
 * @param {Record<string, unknown>} [extra] - What to change.
 * @returns {string} The JSON of a service account key made for the tests.
 */
const keyFile = (extra = {}) =>
  JSON.stringify({
    type: "service_account",
    client_email: "reader@example-project.iam.gserviceaccount.com",
    private_key: pem,
    token_uri: "https://evil.example/token",
    ...extra,
  });

/**
 * Reads a base64url piece of a JWT.
 * @param {string} piece - The text.
 * @returns {Record<string, unknown>} The JSON inside.
 */
const decode = (piece) =>
  JSON.parse(atob(piece.replaceAll("-", "+").replaceAll("_", "/")));

describe("parseServiceAccount", () => {
  it("reads the two fields the code needs", () => {
    const account = parseServiceAccount(keyFile());
    expect(account.client_email).toBe(
      "reader@example-project.iam.gserviceaccount.com",
    );
    expect(account.private_key.startsWith("-----BEGIN PRIVATE KEY-----")).toBe(
      true,
    );
  });

  it("refuses what is not JSON, without showing it", () => {
    expect(() => parseServiceAccount("clave-secreta-123")).toThrow(
      "The service account key is not valid JSON",
    );
    try {
      parseServiceAccount("clave-secreta-123");
    } catch (error) {
      expect(String(error)).not.toContain("clave-secreta-123");
    }
  });

  it("names the wrong fields and never their values", () => {
    expect.assertions(4);
    for (const extra of [
      { private_key: "not a key at all" },
      { client_email: "no-arroba" },
    ]) {
      try {
        parseServiceAccount(keyFile(extra));
      } catch (error) {
        const message = String(error);
        expect(message).toMatch(
          /wrong or missing fields: (private_key|client_email)/,
        );
        expect(message).not.toContain("not a key at all");
      }
    }
  });
});

describe("base64url", () => {
  it("writes without padding and with the url alphabet", () => {
    expect(base64url("any carnal pleasure")).toBe("YW55IGNhcm5hbCBwbGVhc3VyZQ");
    expect(base64url(new Uint8Array([251, 255, 254]).buffer)).toBe("-__-");
  });
});

describe("createSignedJwt", () => {
  it("has three parts with the claims Google asks for", async () => {
    const account = parseServiceAccount(keyFile());
    const jwt = await createSignedJwt(
      account,
      SEARCH_CONSOLE_SCOPE,
      1_800_000_000,
    );
    const [header, claims] = jwt.split(".");
    expect(jwt.split(".")).toHaveLength(3);
    expect(decode(header)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(decode(claims)).toEqual({
      iss: "reader@example-project.iam.gserviceaccount.com",
      scope: SEARCH_CONSOLE_SCOPE,
      aud: TOKEN_URL,
      iat: 1_800_000_000,
      exp: 1_800_003_600,
    });
  });

  it("is signed with the private key, and the signature checks with the public one", async () => {
    const account = parseServiceAccount(keyFile());
    const jwt = await createSignedJwt(
      account,
      SEARCH_CONSOLE_SCOPE,
      1_800_000_000,
    );
    const [header, claims, signature] = jwt.split(".");
    const bytes = Uint8Array.from(
      atob(signature.replaceAll("-", "+").replaceAll("_", "/")),
      (char) => char.charCodeAt(0),
    );
    const valid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      pair.publicKey,
      bytes,
      new TextEncoder().encode(`${header}.${claims}`),
    );
    expect(valid).toBe(true);
    const changed = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      pair.publicKey,
      bytes,
      new TextEncoder().encode(`${header}.${claims}x`),
    );
    expect(changed).toBe(false);
  });
});

describe("getAccessToken", () => {
  const account = () => parseServiceAccount(keyFile());
  const now = new Date("2026-10-30T07:30:00Z");

  it("sends the signed request to Google's token address and gives the token back", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json({ access_token: "token-de-prueba", expires_in: 3600 }),
    );
    const token = await getAccessToken(
      account(),
      SEARCH_CONSOLE_SCOPE,
      /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchFn)),
      now,
    );
    expect(token).toBe("token-de-prueba");
    const [url, init] = /** @type {[string, RequestInit]} */ (
      /** @type {unknown} */ (fetchFn.mock.calls[0])
    );
    // Never the address from the key file: a copied key must not send the signature elsewhere.
    expect(url).toBe(TOKEN_URL);
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
    expect(body.get("assertion")?.split(".")).toHaveLength(3);
  });

  it("explains a refusal with the status and Google's code, not with the body or the key", async () => {
    const fetchFn = vi.fn(async () =>
      Response.json(
        { error: "invalid_grant", error_description: "secreto del cuerpo" },
        { status: 400 },
      ),
    );
    await expect(
      getAccessToken(
        account(),
        SEARCH_CONSOLE_SCOPE,
        /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchFn)),
        now,
      ),
    ).rejects.toThrow(
      "Google refused the service account sign-in (400, invalid_grant)",
    );
    try {
      await getAccessToken(
        account(),
        SEARCH_CONSOLE_SCOPE,
        /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchFn)),
        now,
      );
    } catch (error) {
      expect(String(error)).not.toContain("secreto del cuerpo");
      expect(String(error)).not.toContain("BEGIN PRIVATE KEY");
    }
  });

  it("refuses an answer that has no token", async () => {
    const fetchFn = vi.fn(async () => Response.json({ expires_in: 3600 }));
    await expect(
      getAccessToken(
        account(),
        SEARCH_CONSOLE_SCOPE,
        /** @type {typeof fetch} */ (/** @type {unknown} */ (fetchFn)),
        now,
      ),
    ).rejects.toThrow("(200, unknown)");
  });
});
