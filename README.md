# Masajes Relax Monterrey

Website for **Masajes Relax Monterrey**, a home massage and facial service in Monterrey, Nuevo León, Mexico. The site is in Spanish (default) and English.

- Live site: https://www.masajesrelaxmty.com/ (the apex domain redirects to `www`)
- Planning: Linear project "Website Refactor 2026"
- Contributing: see [CONTRIBUTING.md](CONTRIBUTING.md)

> The GitHub repository keeps its old name; only the public address changed (REL-26).

## Stack

- [Astro](https://astro.build) (static output) with React islands (`@astrojs/react`) for interactive parts
- JavaScript with JSDoc, type-checked with `checkJs` (`jsconfig.json`); Astro files use TypeScript syntax only in their frontmatter
- Icons from `astro-icon` (Lucide and Simple Icons), fonts self-hosted with Fontsource
- Tests: Vitest and Testing Library (unit), Playwright and axe (end to end and accessibility), Lighthouse CI (speed budgets)
- Hosting: Cloudflare Workers (`@astrojs/cloudflare`, free plan); merging to `main` deploys to production

## Architecture and workflow

- [docs/architecture.md](docs/architecture.md): how the public site, analytics, Google data and the admin area fit together.
- [docs/adr/](docs/adr/README.md): decision records (runtime, database, scheduled jobs, admin sign-in, validation, analytics, and the rejected ones).
- [docs/ai-workflow.md](docs/ai-workflow.md): how tickets are executed with Claude Code and what a human always decides.
- [CLAUDE.md](CLAUDE.md): commands, conventions and security rules for Claude Code sessions.

## Requirements

- Node.js 22.23.4 or newer (`.nvmrc` has the version CI uses)
- npm (comes with Node)

## Setup

```bash
git clone https://github.com/moyfdzz/holistic-spa-landing-page.git
cd holistic-spa-landing-page
npm ci                    # install exactly what package-lock.json says
cp .env.example .env      # then fill in the values (see "Environment variables")
npm run dev               # http://localhost:4321
```

On Windows PowerShell use `copy .env.example .env`. If PowerShell blocks scripts, use `npm.cmd` instead of `npm`.

## Scripts

| Command                 | What it does                                                                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Development server with live reload                                                                                                                           |
| `npm run build`         | Production build (checks and generates the site in `dist/`)                                                                                                   |
| `npm run preview`       | Serves the production build locally                                                                                                                           |
| `npm run check`         | Type-checks Astro files and JSDoc-typed JavaScript                                                                                                            |
| `npm run lint`          | ESLint (Astro, React, accessibility and JSDoc rules)                                                                                                          |
| `npm run lint:fix`      | ESLint with automatic fixes (always review the diff)                                                                                                          |
| `npm run format`        | Formats everything with Prettier                                                                                                                              |
| `npm run format:check`  | Checks formatting without changing files                                                                                                                      |
| `npm test`              | Unit tests (Vitest)                                                                                                                                           |
| `npm run test:watch`    | Unit tests in watch mode                                                                                                                                      |
| `npm run test:coverage` | Unit tests with a coverage report                                                                                                                             |
| `npm run test:e2e`      | End-to-end and accessibility tests (Playwright, desktop and phone)                                                                                            |
| `npm run db:generate`   | Creates a migration in `drizzle/` from changes in `src/server/db/schema.js`                                                                                   |
| `npm run db:migrate`    | Applies the migrations to the database in `DATABASE_URL` (never at request time)                                                                              |
| `npm run lighthouse`    | Lighthouse budgets on the built site (run `npm run build` first); it serves `dist/client` with `scripts/serve-dist.mjs`, which adds gzip like Cloudflare does |

The first time you run the end-to-end tests, install the browser: `npx playwright install chromium`.

Before opening a pull request run the same checks as CI: `npm run lint`, `npm run format:check`, `npm run check`, `npm test` and `npm run test:e2e`.

## Environment variables

Names and purpose only. Never write real values in the code or in Git.

| Name                           | Purpose                                                                                    | Where to set it                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| `PUBLIC_WEB3FORMS_ACCESS_KEY`  | Public access key of Web3Forms, used by the contact form to deliver messages by email      | `.env` locally; Cloudflare (build variable)                                                      |
| `DATABASE_URL`                 | Neon Postgres connection string. A secret: never commit it, print it or paste it in a chat | `.env` locally for `npm run db:migrate`; `.dev.vars` for `npm run dev`; Cloudflare Worker secret |
| `PUBLIC_CLERK_PUBLISHABLE_KEY` | Publishable key of Clerk, used by the `/admin` sign-in. Not a secret                       | `.env` locally (development key); Cloudflare build variable (production key)                     |
| `CLERK_SECRET_KEY`             | Secret key of Clerk. A secret                                                              | `.dev.vars` locally (development key); Cloudflare Worker secret (production key)                 |
| `ADMIN_EMAILS`                 | Emails allowed into `/admin`, separated by commas. Personal data: never commit it          | `.dev.vars` locally; Cloudflare Worker secret                                                    |

`PUBLIC_` variables are readable in the browser, which is how Web3Forms and the Clerk publishable key work; restrict the Web3Forms key to the site's domains in its dashboard. These variables are read at build time: after changing one in Cloudflare (Workers & Pages, the Worker, Settings, Build, Variables and secrets), trigger a new build. A Worker secret is set in Settings, Variables and Secrets, and is read while the site runs.

The two Clerk keys must come from the same instance: development (`pk_test_`, `sk_test_`) on your computer, production (`pk_live_`, `sk_live_`) in Cloudflare. If any of the three Clerk settings is missing, `/admin` answers 503.

## Database

Postgres on Neon, accessed with Drizzle (see [ADR-002](docs/adr/002-database-postgres-drizzle.md)). The public pages are still static; only `src/pages/api/**` routes run on demand.

- **Code:** `src/server/` is server-only (`env.js` validates the variables with Zod and fails with the variable name only; `db/schema.js` is the schema; `db/client.js` creates the client per request). ESLint blocks importing it from `src/islands/` and `src/scripts/`.
- **Change the schema:** edit `src/server/db/schema.js`, run `npm run db:generate`, review the SQL in `drizzle/` and commit it.
- **Apply migrations:** put the connection string of the right Neon branch in `.env` as `DATABASE_URL` and run `npm run db:migrate`. Run it against `main` (production) after merging a migration, and against `preview` to test. Migrations never run at request time.
- **Local development:** use the `preview` branch of Neon. Put `DATABASE_URL` in `.dev.vars` (ignored by Git) so `npm run dev` can read it as a Worker variable. In Cloudflare, `DATABASE_URL` is a Worker secret.
- **Health check:** `GET /api/health` answers 200 when the database responds and 503 otherwise, with no details.
- **Tests:** the migrations are tested against an in-memory Postgres (PGlite), so no Docker or secrets are needed.

## Project structure

```
public/            static files: favicons, web manifest, share image
src/assets/        images (Astro creates resized WebP versions at build time)
src/server/        server-only code: environment, database (Drizzle), health check
drizzle/           committed SQL migrations
src/pages/         routes: Spanish at /, English under /en/ (pages are thin, they render a view)
src/views/         full page content shared by the Spanish and English routes
src/layouts/       base layout (head, SEO tags, header, footer, WhatsApp button)
src/components/    Astro components (Header, Footer, Hero, Services, Faq, ...)
src/islands/       interactive React components
src/data/          content: services, FAQ, testimonials, privacy notice
src/i18n/          translations (es.json, en.json) and helpers
src/config/        site-wide business data (name, phone, hours, social links, URL)
src/utils/         pure helpers (dates, WhatsApp links, SEO data, validation)
src/scripts/       small browser scripts (menu, language switch, WhatsApp button)
src/styles/        design tokens (tokens.css) and global styles (global.css)
tests/e2e/         Playwright tests (smoke tests and accessibility)
docs/              architecture, decision records (docs/adr/), the Claude Code workflow and guides
CLAUDE.md          guide for Claude Code sessions (commands, conventions, security rules)
```

## Business data

Name, phone, WhatsApp number, service area, opening hours, founding year, social profiles and the production address live in `src/config/site.js`. Change them there and every page updates.

## Languages (i18n)

Spanish is the default and lives at `/`; English lives at `/en/`. Both languages must always have the same texts.

- **Add or edit a text:** change the key in both `src/i18n/es.json` and `src/i18n/en.json`. A unit test fails if one file has a key the other does not.
- **Use a text in a component:**

  ```astro
  ---
  import { getLangFromUrl, useTranslations } from "../i18n/utils.js";
  const t = useTranslations(getLangFromUrl(Astro.url));
  ---

  <h2>{t("services.title")}</h2>
  ```

  `t("key", { name: "value" })` fills `{name}` placeholders. A missing English key falls back to Spanish and shows a warning in the console.

- **Links inside the site** must go through `getLocalizedPath("/contact", lang)` so English pages stay in English. Pages whose address differs per language (such as the privacy notice) are listed in `translatedRoutes` in `src/i18n/utils.js`.
- **Add a new page:** create a view in `src/views/`, then a route in `src/pages/` and one in `src/pages/en/` that render it.
- **Add a new language:** add the code to `languages` and `src/i18n/` (new JSON file with the same keys), create its routes under `src/pages/<code>/`, update the `i18n` block in `astro.config.mjs`, the language switcher and the `hreflang` tags in `src/components/Seo.astro`. The key-parity test should then include the new file.

## Content guide

Content lives in `src/data/`, with texts in both languages next to each other. Each file starts with a comment that explains its format.

- **Services** (`services.js`): add an object with `id`, `slug`, `icon` (a Lucide name such as `lucide:droplets`), `image` (imported from `src/assets/images/`), `durationMin` (a number or `[min, max]`) and `text.es` / `text.en` (`name`, `description`, `benefits`, `imageAlt`). The cards, the counters, the contact form options and the business structured data update by themselves.
- **FAQ** (`faq.js`): add `{ id, text: { es: { question, answer }, en: { question, answer } } }`. The structured data for Google updates too.
- **Testimonials** (`testimonials.js`): add only **real** testimonials from clients who agreed, with `consent: true`, first name and initial only (for example "Ana G."). The section appears when there is at least one.
- **Privacy notice** (`privacy.js`): edit the sections and update `privacyUpdated` with the new date.

## Code conventions (JSDoc)

The ESLint `jsdoc` plugin enforces these rules (see `eslint.config.js`), and `npm run check` type-checks them.

- **Every exported function** (declarations, arrow functions and function expressions) has a JSDoc block with a description, `@param` for each parameter and `@returns`, and `@throws` when it can throw. Parameter and return descriptions are required.
- **Every data model has a `@typedef`**: `SiteConfig`, `Service`, `FaqItem`, `Testimonial`, `PrivacySection`, `ContactValues`, ... Use `@type` to apply it to the data.
- **Component props**: Astro components declare `interface Props` in the frontmatter with a `/** */` comment on each prop; React islands document their props with a `@typedef` and use it in the `@param` of the component.
- **Utility files** start with a short file-level comment and `@module`.
- **Do not describe types that TypeScript already knows** in the text; describe what the value means.

```js
/**
 * Returns how many whole calendar years have passed since a start year.
 * @param {number} startYear - The year the business started, for example 2017.
 * @param {Date} [now] - The date to measure against. Defaults to today.
 * @returns {number} Whole years between `startYear` and the year of `now`.
 * @throws {TypeError} If `startYear` is not an integer.
 */
export function getYearsSince(startYear, now = new Date()) {
  /* ... */
}
```

## Design system

- **Tokens** (`src/styles/tokens.css`): colors, fluid type scale, spacing, radius, shadows and motion. Components use the semantic names (`--color-primary`, `--color-text-muted`, ...) rather than raw colors.
- **Icons**: inline SVG from `astro-icon` (see CONTRIBUTING.md). Decorative icons use `aria-hidden="true"`; icon-only buttons need an `aria-label`.
- **Accessibility and motion**: every interactive element has a visible focus style, targets are at least 44 px, text meets WCAG AA contrast, and animations stop when the visitor prefers reduced motion. Automatic checks run on every page in both languages.

## Testing and quality

- Unit tests live next to the code as `*.test.js` / `*.test.jsx`. End-to-end tests are in `tests/e2e/` and test the production build.
- Pull requests run four required checks in GitHub Actions: **Quality checks** (lint, formatting, types, unit tests, build), **End-to-end tests**, **PR title** (Conventional Commits) and **Lighthouse** (performance 90, accessibility 95, best practices 95, SEO 95 and size budgets).
- A **Security** workflow runs on pull requests, on `main` and every Monday: **Secrets (gitleaks)** and **npm audit (production)**, which fails on a high or critical advisory. Actions are pinned to a full commit SHA, and Dependabot keeps the pins up to date.
- ESLint and Prettier run on staged files before every commit (Husky and lint-staged). Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) with the Linear ticket as the scope, for example `feat(REL-18): add service cards`.

## Deployment

The site is deployed on Cloudflare Workers (free plan) from this repository with Workers Builds.

- Merging to `main` builds with `npm run build` and deploys with `npx wrangler deploy`. Other branches run `npx wrangler versions upload` and get a preview URL.
- The Worker is named `holistic-spa-landing-page` (`wrangler.jsonc`); the name must match the Worker in the Cloudflare dashboard.
- Security headers are in `public/_headers`. Redirects for the old `.html` addresses are in `astro.config.mjs`; the redirect from the apex domain to `www` is a Cloudflare Redirect Rule.
- Set the build variables in Cloudflare (Workers & Pages, the Worker, Settings, Build, Variables and secrets), then trigger a new build.
- Production address, redirects from the old address and Google Search Console are covered by the launch ticket (REL-26); the move from Vercel is REL-54.

## Workflow

One branch per Linear ticket, named `type/REL-N-short-slug` (for example `feature/REL-18-services-catalog`), merged through a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for the full flow.
