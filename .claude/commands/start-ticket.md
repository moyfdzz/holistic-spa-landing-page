---
description: Start a Linear ticket: read it, branch from main and plan the work
argument-hint: REL-123
---

Start the Linear ticket `$ARGUMENTS`.

1. Read the ticket in Linear in full, including its comments, decisions and acceptance criteria. If something is unclear and only the owner can answer it, ask before coding.
2. Read `git status -sb`. If the checkout holds another session's work, stop and tell me.
3. Fetch `origin/main` and create the branch from it with `--no-track`, named `type/REL-N-short-slug` (never a generated name such as `claude/...`, and never one branch for two tickets). Check that the git identity is the owner's, not a bot's.
4. Move the ticket to In Progress.
5. Read `CLAUDE.md`, `docs/agent-notes.md` and the ADRs the ticket touches.
6. Tell me the plan step by step, in Spanish and simple language: files to change, tests to add, and each decision you need from me with a recommendation. For a big change (more than about 8 files, or a decision that changes what is built) wait for my "sí" before changing files; for a small one, say the plan and go ahead.

For a change to code, run `/code-review` yourself on the local branch before the first push and fix the valid findings; then, when the checks are green, push and open the PR without asking (`/open-pr`, standing order). DNS, Cloudflare and GitHub settings, CI, secrets, and anything that publishes content or sends messages still need my OK first, unless the ticket itself is that change.
