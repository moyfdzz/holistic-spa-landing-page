---
description: Open a pull request for the current branch and watch CI
---

1. Review the full diff for secrets, personal data and client data. If you find any, stop and tell the owner.
2. Run `/check-all` and fix what fails.
3. Push the branch and open the PR ready for review (not a draft), filling `.github/pull_request_template.md`. The title is a Conventional Commit with the ticket as scope. Make sure the body has no Claude or Anthropic attribution.
4. Move the Linear ticket to In Review with the PR link.
5. Watch CI until all checks are green, fixing failures that belong to the PR, and tell the owner when it is green. The owner does the squash merge.
