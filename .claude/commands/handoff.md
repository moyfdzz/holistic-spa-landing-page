---
description: Write the state of the day into CLAUDE.local.md so the next session can start with "continúa"
---

Rewrite `CLAUDE.local.md` (ignored by git) in the root of the main checkout with the state of the project right now, so a new session can start from it. Keep the whole file **under 40 lines**: it is loaded in every session.

1. Look first: `git status --short`, `git branch --show-current`, `git log --oneline -5`, `gh pr list`, and the Linear tickets of team `REL` that are In Progress or In Review.
2. Write these sections, in English, short:
   - **Where we are:** branch, last commit on `main`, open PRs, the ticket In Progress or In Review and its status, the last migration applied in production (if the owner said so).
   - **Doing now:** the step we were in, and what the owner was last told or asked to do. If the owner has to do something by hand, say which step and what they had not answered yet.
   - **Next:** the next 1 to 3 things, in order, with the ticket numbers.
   - **Waiting for the owner:** decisions, as ticket numbers or one line each (at most five; older ones go to their ticket). Things to try in production do **not** go here: check that every merged feature of the session has its line in the pinned ticket REL-65, and add the missing ones there.
   - **Watch out:** only things that are true today and not in `docs/agent-notes.md` (a flaky check, a ticket left open or closed by mistake, something unverified).
3. Leave out whatever is in `docs/agent-notes.md`, in `CLAUDE.md` or in the tickets. Point to a ticket instead of copying it.
4. **Never write a secret or personal data**: no connection string, key, token, email or client name. Names of variables only.
5. If this session taught a lesson that will still be true in a month, do **not** put it in `CLAUDE.local.md`: tell me, and propose the line for `docs/agent-notes.md` (a change to that file goes in a PR with a ticket).
6. The state lives in one place only. If a memory note of Claude Code also holds the state of the day, turn it into a one-line pointer to `CLAUDE.local.md`. Only one session runs `/handoff` at a time: it rewrites the whole file.
7. Tell me, in Spanish and in two or three lines, what the next session will find, and remind me that I can start it with "continúa".
