# ADR-001 Runtime: Astro on-demand routes on Cloudflare Workers

Status: Accepted
Date: 2026-10-29
Tickets: REL-54, REL-34

## Context

The site is a static Astro site. The next features (chat API, analytics collector, admin area, scheduled jobs) need server code. The business is a one-person home massage service, so infrastructure has to stay small, cheap and allowed for commercial use. Vercel Hobby is for non-commercial use only and limits cron jobs to once a day, so the site was moved to Cloudflare Workers (free plan) in REL-54. The domain's DNS was already on Cloudflare.

## Decision

- Keep one repository and one Astro project. Public pages stay static (prerendered); server code lives in on-demand routes (`export const prerender = false`) served by the same Worker through `@astrojs/cloudflare`.
- Deploy with Cloudflare Workers Builds from `main` (`npx wrangler deploy`). Other branches get preview URLs (`npx wrangler versions upload`).
- Configuration is `wrangler.jsonc`; secrets and runtime variables are Worker secrets, build-time `PUBLIC_` variables are build variables (see the README).
- Security headers for static files are in `public/_headers`; on-demand routes will set theirs in a middleware.
- Free-plan limits that shape the design: 100,000 Worker requests per day, 10 ms CPU per invocation (waiting for I/O does not count), 5 Cron Triggers per account, no collecting card data on our own pages.

## Consequences

- No separate backend to deploy, monitor or pay for; one pipeline for site and API.
- The server code must run on the Workers runtime (Web APIs, `nodejs_compat` for some Node modules). Libraries that need native Node modules are out.
- Vitest runs unit tests in jsdom, where the adapter's workerd runtime cannot start, so the adapter is turned off when `VITEST` is set (`astro.config.mjs`).
- `astro preview` runs the Worker locally and sends files uncompressed; Lighthouse CI therefore serves `dist/client` with `scripts/serve-dist.mjs`.

## Rejected alternatives

- **A separate backend service** (Node server, container or another platform): more infrastructure, a second deploy and a second bill for a one-person business.
- **Staying on Vercel:** the Hobby plan does not allow commercial use, and cron jobs run at most once a day.
