---
description: Start a Linear ticket: read it, branch from main and plan the work
argument-hint: REL-123
---

Start the Linear ticket `$ARGUMENTS`.

1. Read the ticket in Linear in full, including its decisions and acceptance criteria. If something is unclear and only the owner can answer it, ask before coding.
2. Move the ticket to In Progress.
3. Fetch `origin/main` and create the working branch from it with `--no-track`. Check that the git identity is the owner's, not a bot's.
4. Read `CLAUDE.md` and the ADRs the ticket touches.
5. Write a short plan: files to change, tests to add, anything that needs the owner's confirmation (DNS, CI, secrets, publishing). Share it, then implement.
