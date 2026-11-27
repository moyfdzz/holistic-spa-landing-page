/**
 * Security headers for public pages that the Worker renders.
 * @module utils/securityHeaders
 */

/**
 * The same headers `public/_headers` gives to static files; a test keeps both equal.
 * @type {Readonly<Record<string, string>>}
 */
export const securityHeaders = Object.freeze({
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.web3forms.com; form-action 'self' https://api.web3forms.com; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
});
