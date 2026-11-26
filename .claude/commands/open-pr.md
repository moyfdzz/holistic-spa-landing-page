---
description: Open a pull request for the current branch and watch CI
---

1. Check `git branch --show-current`: it must be the branch of the ticket.
2. Review the full diff for secrets, personal data and client data. If you find any, stop and tell the owner.
3. Run `/check-all` and fix what fails.
4. For a change to code, run `/code-review` (medium unless the owner asks for another level) on the local branch if it has not run yet, check each finding against the code, fix the valid ones and run the checks again. Docs only: no review. A change to CI only shows its result in a PR: open it first and review while the checks run.
5. If the work taught something that will still be true in a month, add it to `docs/agent-notes.md` in a commit of this branch now, so it is in the first version of the PR. No filler.
6. Push the branch and open the PR ready for review (not a draft), filling `.github/pull_request_template.md`, without asking (standing order). Say which review findings were left and why. The title is a Conventional Commit with the ticket as scope. Make sure the body has no Claude or Anthropic attribution.
7. Move the Linear ticket to In Review with the PR link.
8. Watch CI until all checks are green, fixing failures that belong to the PR, and tell the owner when it is green. The owner does the squash merge.
