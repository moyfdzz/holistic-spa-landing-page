# Notes for coding agents

What does not change from one session to the next. Read this before writing code. Public project facts and commands are in [../CLAUDE.md](../CLAUDE.md); how the use of an agent is controlled is in [ai-workflow.md](ai-workflow.md).

- **The state of the day** is not here: it is in `CLAUDE.local.md` (ignored by git, rewritten by `/handoff`) and in the Linear ticket In Progress or In Review.
- **What the owner still has to try in production** is the pinned Linear ticket REL-65.
- **Facts the business owner still has to give** are in REL-53.

Personal rules (attribution, secrets, confirmations) are in the owner's user-level `CLAUDE.md` and apply here too.

## The owner

The owner speaks Spanish: reply in Spanish, in simple language, and keep code, commits, PRs, docs and tickets in English. The site copy is in both languages. The owner is not a shell expert: give exact copy-paste steps for **Windows PowerShell**, say what the result should look like, and give **one step at a time**. The owner is in Mexico (UTC-6, no DST): check `date` before writing a date. When a decision is needed, give the options with their trade-offs and a recommendation, so "sí a lo recomendado" is an informed choice.

## Decided with the owner (do not reopen)

- Hosting on **Cloudflare Workers** ([ADR-001](adr/001-runtime-cloudflare-workers.md)), Postgres on Neon with Drizzle ([ADR-002](adr/002-database-postgres-drizzle.md)), Clerk for `/admin` ([ADR-005](adr/005-admin-auth-clerk.md)), first-party cookieless analytics ([ADR-008](adr/008-web-analytics-first-party.md)).
- Spanish at `/`, English at `/en/`; every text exists in both languages.
- **No website chat, no AI assistant and no Stripe deposit** (2026-11-26): clients and the owner talk on WhatsApp, which stays manual. `/admin` is for website and Google statistics ([ADR-007](adr/007-assistant-policy.md), rejected).
- The site never shows **prices or payment details** (bank account, PayPal link); the owner sends payment details over WhatsApp once an appointment is confirmed. The service is **professional massage only**.
- **Squash merge only**, done by the owner; the PR title becomes the commit message.

## The flow of a ticket

1. **Branch.** One Linear ticket (team `REL`) per branch, cut from an up-to-date `origin/main` with `--no-track`, named `type/REL-N-short-slug` (`/start-ticket REL-N`). Never a generated name such as `claude/...` and never one branch for several tickets: PRs #65, #66 and #68 all came from `claude/nice-planck-eiwxcl`, which hides which ticket a branch belongs to. A session in the cloud renames its branch before the first push (`git branch -m`).
2. **Plan.** Say the plan and the decisions you need, with a recommendation for each. **A plan first for a big change even when the owner says "empieza"**: more than about 8 files, or a decision that changes what is built; wait for "sí". If the plan changes the scope of the ticket, say so, get the owner's OK and leave a comment on the ticket.
3. **Build and check** (next section). Report faithfully what was verified and what was not.
4. **Review before the push.** For a change to code, run `/code-review` yourself on the local branch before the first push (medium unless the owner asks for another level; `max` and `ultra` only when asked), check each finding against the code, fix the valid ones, run the checks again, and say in the PR which findings were left and why. So the PR opens once, already reviewed. Docs only: no review. **Exception:** a change to CI only shows its result in a PR, so open the PR first and review while the checks run. Do not open follow-up tickets for findings of the same PR.
5. **Lessons.** If the work taught something that will still be true in a month, add it to this file **before** the PR is opened, so it is in its first version. No filler, and nothing the code, the git history or the ticket already says.
6. **Push and open the PR without asking** (standing order of the owner, 2026-11-26) when the checks are green: `/open-pr`. **Merge, deploys, DNS, Cloudflare and GitHub settings, CI, secrets, migrations in production, and anything that publishes content or sends messages still need the owner**, unless the ticket itself is that change and the owner approved it.
7. **Watch the CI.** Right after the PR is opened there are no checks for a few seconds: wait with a `Monitor` and an `until` loop on `gh pr checks <n>` until the first job appears, then wait for the rest. Do not re-run a job to hide a failure: read its log.
8. **Merge** is the owner's ("ya hice merge"). Then: `git switch main; git pull --ff-only`, `git branch -D <branch>` (a squash merge leaves it "not merged"), `git fetch --prune`, check that Linear moved the ticket to Done (reopen it if more work remains), and **add the checks of the feature to REL-65** (one line under "Features" plus a comment with numbered steps) instead of only writing them in the chat.
9. **One session per PR.** After the merge run `/handoff`, and start the next ticket in a new session ("continúa"). A long session carries the noise of old work and costs much more.

**A PR built on top of a PR that is not merged yet conflicts after the squash** of the first one. Wait until the first is in `main`; never force-push without the owner.

**Tickets:** create one only when the owner asks or agrees, after searching Linear for a duplicate. English, with problem, scope and "Done when"; what only an agent needs goes in a collapsible "Agent notes" section at the end.

## Checks before each commit

- `/check-all` (lint, format check, type check, unit tests, build, e2e, and Lighthouse when the change can affect speed, layout or scripts). A hook of `.claude/settings.json` formats each file that Write or Edit touches; a file changed by a script or a shell command still needs `npx prettier --write`.
- **Read the result lines of each log**, not only the exit code of a background task: the exit code in its notice is the one of its last command, so `npm test > log 2>&1; echo done` reports success even when tests failed.
- **Check `git branch --show-current` right before each commit**: another session can switch the shared checkout, and uncommitted changes follow the switch.
- Stage named files (`git add -A -- <named paths>`, never `git add .`), read `git diff --staged` for secrets and client data, commit, then check `git status --short` and `git log --oneline -1`. Husky runs lint-staged and commitlint: never `--no-verify`.
- **commitlint rejects a header over 100 characters (aim for 72) and a body line over 100**: write the message to a file in the scratchpad and use `git commit -F <file>`. If the hook rejects it, nothing was committed. Fix mistakes with a new commit, never a force-push without the owner.

## CI

- **The repository is public** (checked 2026-11-26): treat every commit, log, artifact and PR text as readable by anyone.
- The ruleset of `main` requires checks **by job name** (**Quality checks**, **End-to-end tests**, **Lighthouse**, **PR title**): renaming or removing a job blocks every merge until the owner changes the ruleset.
- Actions stay pinned to a full commit SHA with the version in a comment. The version and checksum of gitleaks in `security.yml` are updated by hand.
- GitHub disables the scheduled workflows of a public repository after 60 days without activity; the owner re-enables them in the Actions tab.
- **npm audit (production)** can turn red with no change of ours. It is not required: read the advisory, and fix it in its own commit with the smallest update that clears it. `--omit=dev` still covers `wrangler`, because `@astrojs/cloudflare` depends on it.

## Traps of the code

- **A `client:load` island is plain HTML until React arrives.** What the visitor types or focuses before that fires no React handler, and the next render writes the initial state over controlled fields. Read the page in the mount effect (`readEarlyValues` in `ContactForm.jsx`) and test it by holding the island script back (`tests/e2e/analytics.spec.js`). The order of two scripts is not guaranteed either: report events with `track`, which keeps them until the tracker is ready.
- **Clerk without its browser script.** The server must pass on the `Set-Cookie` headers of the request state (production sends them with no redirect, development with one, so development hides a mistake). Cookies also exist with a suffixed name and for the whole site, and a session token stays valid until it expires even after the session is revoked, so the guard asks Clerk. Test cookie behaviour with the real library (`sign-out.clerk.test.js`), not only with fakes.
- **`public/_headers` covers static files only.** A public page that the Worker renders (the 404) sets `securityHeaders` itself.

## Reporting

Say what was verified, what was not and why, and never claim something works that was not tried. **Do not write a number you did not count.** Mocked tests only prove the code against the fixtures you wrote: say so, and try the real thing when you can. Do not state a cause you did not verify. Facts about third-party limits and terms go in an ADR with their source and the date they were read. Code reads like the code around it, and comments say why in plain English.

## Traps of the tools on this machine

- **Long commands.** A Bash command with several heredocs, quotes, backticks or accents can fail with "unexpected EOF" and run nothing, and a heredoc or `node -e` loses backslashes (`\n`, `\b`, regular expressions) while the code still runs, wrongly. Write scripts and long texts with the Write tool into the scratchpad and run them with `node`; use `--body-file` with a literal path for PR bodies. Never chain `sleep`: use `Monitor` with an `until` loop.
- **Never undo an experiment with `git checkout -- <file>` or `git restore` on a file with uncommitted work**: it throws the work away. The project settings ask the owner before either runs; copy the file aside before the experiment.
- Git Bash turns an argument that starts with `/` into a Windows path: pass paths without the leading slash or set `MSYS_NO_PATHCONV=1`.
- **Windows PowerShell 5.1** corrupts accents when it reads a file with `Get-Content -Raw` and writes it back, and corrupts binary data piped to a native command: edit files with the Edit tool. The owner's PowerShell may block `npm.ps1`: use `npm.cmd`. A double-quoted here-string drops backticks: write commit messages to a file.
- **Python on Windows:** when Python edits a repo file, open it with `newline=""`, or text mode rewrites every LF as CRLF. `python3` does not exist in Git Bash; use `python -I`.
- **Stopping a background `astro preview` can leave its server on the port**, still serving the old build (after a rebuild the pages load with no CSS, because the asset names changed). Stop it with `npx astro preview stop` or by port (`Get-NetTCPConnection -LocalPort 4321 -State Listen`, then `Stop-Process`), and only the process you started.
- Do not edit a file by line number after another edit added lines to it: match on text. Prettier realigns Markdown tables.
- Deleting text with an empty replacement in Edit can also remove the line break after it: after removing the last row of a Markdown table, check that the next paragraph is still outside it (Prettier folds it in without an error).
- The Bash tool has no `jq`: filter JSON with `gh ... --jq`.
- **The permission classifier** blocks history rewrites and force-pushes even after the owner said yes: tell the owner what to type with the `!` prefix. **Except anything that asks for a value** (`wrangler secret put`): the `!` shell has no terminal and uploads an empty value. The owner runs it in their own PowerShell window; check afterwards with `wrangler secret list`.
- **Migrations in production are the owner's** (`DATABASE_URL` is a secret): give the PowerShell commands as **one single line** joined with semicolons, ending with `Remove-Item Env:DATABASE_URL`, and never ask for or accept the connection string.
- **After merging a Dependabot PR, run `npm ci` before trusting a local run**, and `npx playwright install chromium` when it bumped Playwright (or set `PLAYWRIGHT_CHROMIUM_PATH`).
- **To fix what a Dependabot PR breaks**, branch from `main`, then merge the Dependabot branch into a temporary local branch (never pushed) and run the checks there: `main` may still run the old tool. Installing the newer Chromium can remove the previous one from the shared cache, so switch back, run `npm ci` and install it again.
- **Port 4321 is shared with the sister projects.** With another session running, a local e2e run reuses whatever server holds the port (`reuseExistingServer`) and tests the wrong site: many failures, with another business in the page titles. Check the owner of the port (`Get-NetTCPConnection -LocalPort 4321 -State Listen`), never stop a process you did not start, and run with an untracked config on another port that imports `playwright.config.js` (the same for the ports in `lighthouserc.json`).
- **Unit tests on a busy machine** can lose workers before they start (exit code 2147483651, seen with the database tests): run `npx vitest run --maxWorkers=4 --hookTimeout=60000` and say so.
- **Memory of Claude Code** lives under `~/.claude/projects/<the project folder with dashes>/memory/`; copy the folder name from an existing path, a wrong dash creates a stray folder.
- **A background session cannot write `CLAUDE.local.md`** (isolation guard): `/handoff` leaves a draft in the job folder and gives the owner the copy command.
- **In a session isolated in a worktree**, a command that mixes git with other commands can be refused: run git as plain, separate commands.
