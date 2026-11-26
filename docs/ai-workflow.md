# Working with Claude Code

This project is built by one developer with Claude Code (Anthropic's coding agent) doing much of the implementation. This page explains how that works and where a human always decides, so that the use of an AI agent is controlled and visible.

## How a ticket is executed

1. **Ticket.** Every change starts as a Linear ticket (team `REL`) with scope, decisions and acceptance criteria. Decisions that are already taken are written in the ticket, so the agent does not reopen them.
2. **Plan.** The agent reads the ticket, `CLAUDE.md`, `docs/agent-notes.md` and the related ADRs, and plans the change. Anything only the owner can answer is asked before coding, and a big change waits for the owner's approval of the plan.
3. **Implement.** On a branch from the latest `main` named for the ticket, with tests next to the code.
4. **Verify.** The agent runs the same checks as CI (lint, formatting, type check, unit tests, build, end-to-end and Lighthouse) and re-reads its own diff before pushing.
5. **Review.** For a change to code, the agent runs an automated code review on the local branch before the first push and fixes the valid findings, so the pull request opens once, already reviewed.
6. **Pull request.** Opened ready for review from the PR template. The agent watches CI and fixes failures that belong to the change. It never skips, disables or quarantines a test to get green. Lessons that will still hold in a month go into `docs/agent-notes.md` in the same pull request.
7. **Merge.** The owner reviews and squash-merges, then tries the feature in production from a pinned checklist ticket.
8. **Handoff.** `/handoff` writes the state of the day to an ignored local file, and the next ticket starts in a new session.

The commands in `.claude/commands/` (`/start-ticket`, `/check-all`, `/open-pr`, `/handoff`) capture the repeated steps.

## What a human always decides

- Merging a pull request.
- Changes to DNS, Cloudflare and GitHub settings, CI workflows, rulesets and secrets.
- Anything that publishes content or sends messages to real people.
- Business facts and wording: policies, coverage, payment methods, the privacy notice, and the text about professional-only service.
- Spending: the Anthropic Console spend limit and the account limits of other services.

## Guardrails for the agent

- Secrets stay out of the repository, logs and chat; only variable names are shared.
- No real client data in fixtures, tests or evaluations.
- Commits use the owner's identity and carry no attribution; this page is where the use of an AI agent is documented.
- Two quality gates protect the shipped assistant: the guardrails in code (ADR-007) and the evaluation that runs in CI (REL-43, REL-44).

## Examples

- [PR #44: migrate hosting from Vercel to Cloudflare Workers](https://github.com/moyfdzz/holistic-spa-landing-page/pull/44). The agent found and fixed a Lighthouse regression caused by the new preview server, kept the public URLs identical and fixed a CI failure caused by the Node version.
- [PR #47: add security.txt and block AI training crawlers](https://github.com/moyfdzz/holistic-spa-landing-page/pull/47).
