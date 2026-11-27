# CLAUDE.md

Guide for Claude Code sessions on this repository: the website of Masajes Relax Monterrey, a real home-massage business in Monterrey, Mexico. A fresh session should be able to run every check from this file.

## Stack

- Astro 7 (static output plus on-demand routes) with React islands, deployed to Cloudflare Workers (`@astrojs/cloudflare`, `wrangler.jsonc`).
- JavaScript with JSDoc, type-checked with `checkJs`. No TypeScript files (Astro frontmatter may use TypeScript syntax).
- Spanish at `/` and English at `/en/`; texts in `src/i18n/`, content in `src/data/`, business facts in `src/config/site.js`.
- Contact form posts to Web3Forms (`PUBLIC_WEB3FORMS_ACCESS_KEY`).
- Postgres on Neon with Drizzle and Zod (`src/server/`, migrations in `drizzle/`); the `/admin` pages and the API routes under `src/pages/api/` are on demand (`prerender = false`), everything else is prerendered.
- Clerk signs the owner in to `/admin`, the private area for website and Google statistics (ADR-005).

## Commands

Run these before every commit. All must pass; CI runs the same ones.

| Command                | Purpose                                            |
| ---------------------- | -------------------------------------------------- |
| `npm run lint`         | ESLint                                             |
| `npm run format:check` | Prettier (`npm run format` fixes)                  |
| `npm run check`        | Astro and JSDoc type check                         |
| `npm test`             | Unit tests (Vitest)                                |
| `npm run build`        | Production build into `dist/`                      |
| `npm run test:e2e`     | Playwright (builds and serves the site itself)     |
| `npm run lighthouse`   | Lighthouse budgets (run `npm run build` first)     |
| `npm run db:generate`  | New migration from `src/server/db/schema.js`       |
| `npm run db:migrate`   | Apply migrations to `DATABASE_URL` (owner runs it) |

Environment notes:

- Node.js 22.23.4 or newer (`.nvmrc`). Astro refuses to run on older versions.
- If a Chromium is preinstalled, set `PLAYWRIGHT_CHROMIUM_PATH` for e2e and `CHROME_PATH` for Lighthouse to its path instead of downloading one.
- `astro preview` may start in the background in an agent session; when a command needs it in the foreground, unset `CLAUDECODE` for that command. Stop it with `npx astro preview stop`.
- Do not use `pkill` in the cloud container: it kills the shell.
- `scripts/serve-dist.mjs` serves `dist/client` with gzip for Lighthouse, because `astro preview` sends files uncompressed.

## Conventions

- **Branches:** from an up-to-date `origin/main` with `--no-track`, named for the ticket.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org) with the Linear ticket as scope, for example `feat(REL-54): ...`. Body lines are at most 100 characters (commitlint). Git identity is the owner's (`moyfdzz`, GitHub noreply email), never a bot identity.
- **Attribution:** no Claude or Anthropic attribution in commits, PR titles, PR bodies or comments. If a tool adds a footer to a PR body, edit it out and tell the owner.
- **Pull requests:** use `.github/pull_request_template.md`. Open the PR ready for review (not as a draft) and watch CI until it is green. Squash merge only, done by the owner.
- **Linear:** In Progress when starting, In Review with the PR link, Done after the merge. Linear closes a ticket when its PR merges; reopen it if more work remains.
- **Code:** JSDoc on exported functions, tests next to the code (`*.test.js`), both languages for every text, links through `getLocalizedPath`.
- **Public pages:** canonical addresses have no trailing slash except the home pages (`/` and `/en/`). Use `publicPath` for the current page's address.

## Security rules

- Never commit or print secrets, tokens, keys or personal data. Only names go in `.env.example`; `.env*` and `.dev.vars*` stay ignored.
- No real client data (names, phones, chats) in fixtures, tests or logs. Anonymize before anything enters the repo.
- `DATABASE_URL` and other connection strings are secrets: never read them aloud, log them, or run migrations against production; the owner does that.
- Never send messages to real people from development or CI.
- The site never shows prices or payment details (bank account, PayPal link); the owner sends payment details over WhatsApp once an appointment is confirmed. The service is professional massage only.
- Ask the owner before changing: DNS, Cloudflare or GitHub settings, CI workflows, rulesets, secrets, or anything that publishes content or sends messages.

## Where things are

- Architecture and decisions: `docs/architecture.md`, `docs/adr/`.
- How tickets are executed with Claude Code: `docs/ai-workflow.md`.
- What an agent must know that does not change between sessions (the owner, the flow of a ticket, traps of the tools): `docs/agent-notes.md`. Read it before writing code.
- The state of the day: `CLAUDE.local.md` (ignored by git), rewritten by `/handoff` at the end of a session.
- Slash commands for repeated flows: `.claude/commands/` (`/start-ticket`, `/check-all`, `/open-pr`, `/handoff`). A hook in `.claude/settings.json` formats each file an agent writes.
- Pending facts from the business owner: Linear REL-53. What the owner still has to try in production: Linear REL-65 (pinned).
