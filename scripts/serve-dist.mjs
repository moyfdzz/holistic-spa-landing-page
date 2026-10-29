/**
 * Serves the built site (`dist/client`) with gzip, the way Cloudflare serves it in production.
 * Used by Lighthouse CI: `astro preview` runs the Worker locally and sends files uncompressed,
 * which makes the measured speed worse than the real one.
 * Usage: node scripts/serve-dist.mjs [port]
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const root = resolve("dist/client");
const port = Number(process.argv[2] ?? 4321);

/** @type {Record<string, string>} */
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};
const compressible = /^(text\/|application\/(json|xml|manifest)|image\/svg)/;

/**
 * Finds the file for a request path: `/contact` is `contact.html`, `/en/` is `en/index.html`.
 * @param {string} pathname - The path of the request, already decoded.
 * @returns {Promise<string | undefined>} The file path, or undefined when there is none.
 */
async function findFile(pathname) {
  const base = normalize(join(root, pathname));
  if (!base.startsWith(root)) return undefined;
  for (const candidate of [base, `${base}.html`, join(base, "index.html")]) {
    const info = await stat(candidate).catch(() => undefined);
    if (info?.isFile()) return candidate;
  }
  return undefined;
}

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  const file = await findFile(decodeURIComponent(pathname));
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain" }).end("Not found");
    return;
  }
  const type = types[extname(file)] ?? "application/octet-stream";
  /** @type {Record<string, string>} */
  const headers = { "Content-Type": type };
  let body = await readFile(file);
  if (compressible.test(type)) {
    body = gzipSync(body);
    headers["Content-Encoding"] = "gzip";
  }
  response.writeHead(200, headers).end(body);
}).listen(port, () => console.log(`Serving dist/client on localhost:${port}`));
