// @vitest-environment node
/**
 * Signing out checked against the real Clerk backend library, with a key pair made here (no
 * network). The browser is a small cookie jar: a cookie is only removed by an expiry that names
 * the same cookie and the same domain, which is how browsers do it.
 */
import { Buffer } from "node:buffer";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { describe, expect, it } from "vitest";
import { signedOutResponse } from "./sign-out.js";

const HOST = "www.example.com";
const SITE = "example.com";
const publishableKey = `pk_live_${Buffer.from(`clerk.${SITE}$`).toString("base64")}`;
/** The suffix Clerk adds to its cookie names, made from the publishable key. */
const suffix = createHash("sha1")
  .update(publishableKey)
  .digest("base64url")
  .slice(0, 8);
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});
const jwtKey = publicKey.export({ type: "spki", format: "pem" }).toString();

/**
 * Makes a session token like the ones Clerk issues, valid for one more minute.
 * @param {number} now - The time in seconds.
 * @returns {string} The signed token.
 */
function sessionToken(now) {
  const part = (/** @type {object} */ value) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const head = part({
    alg: "RS256",
    typ: "JWT",
    kid: "test-key",
    // The category Clerk puts on session tokens; the library refuses any other.
    cat: "cl_B7d4PD111AAA",
  });
  const body = part({
    iss: `https://clerk.${SITE}`,
    azp: `https://${HOST}`,
    sub: "user_1",
    sid: "sess_1",
    iat: now,
    nbf: now - 5,
    exp: now + 60,
  });
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(`${head}.${body}`),
    privateKey,
  ).toString("base64url");
  return `${head}.${body}.${signature}`;
}

/**
 * The cookies a signed-in browser holds: each one under its plain and its suffixed name.
 * @returns {{ name: string, domain: string, value: string }[]} The jar.
 */
function signedInJar() {
  const now = Math.floor(Date.now() / 1000);
  const token = sessionToken(now);
  return ["", `_${suffix}`].flatMap((end) => [
    { name: `__session${end}`, domain: HOST, value: token },
    { name: `__client_uat${end}`, domain: SITE, value: String(now - 10) },
  ]);
}

/**
 * Applies the `Set-Cookie` expiries of an answer to the jar.
 * @param {ReturnType<typeof signedInJar>} jar - The cookies before.
 * @param {Response} response - The answer.
 * @returns {ReturnType<typeof signedInJar>} The cookies that stay.
 */
function afterAnswer(jar, response) {
  const expired = response.headers.getSetCookie().map((line) => ({
    name: line.slice(0, line.indexOf("=")),
    domain: /Domain=([^;]+)/i.exec(line)?.[1] ?? HOST,
  }));
  return jar.filter(
    (cookie) =>
      !expired.some(
        (gone) => gone.name === cookie.name && gone.domain === cookie.domain,
      ),
  );
}

/**
 * A page visit carrying the jar.
 * @param {ReturnType<typeof signedInJar>} jar - The cookies.
 * @returns {Request} The request.
 */
function visit(jar) {
  return new Request(`https://${HOST}/admin`, {
    headers: {
      accept: "text/html",
      "sec-fetch-dest": "document",
      cookie: jar.map(({ name, value }) => `${name}=${value}`).join("; "),
    },
  });
}

describe("signing out, as the Clerk library sees it", () => {
  const clerk = createClerkClient({ secretKey: "sk_live_x", publishableKey });
  const authenticate = (/** @type {Request} */ request) =>
    clerk.authenticateRequest(request, { publishableKey, jwtKey });

  it("starts signed in", async () => {
    const state = await authenticate(visit(signedInJar()));
    expect([state.status, state.reason, state.message]).toEqual([
      "signed-in",
      null,
      null,
    ]);
  });

  it("leaves the browser signed out", async () => {
    const jar = signedInJar();
    const left = afterAnswer(jar, signedOutResponse(visit(jar)));
    const state = await authenticate(visit(left));
    expect(state.status).toBe("signed-out");
    expect(left).toEqual([]);
  });
});
