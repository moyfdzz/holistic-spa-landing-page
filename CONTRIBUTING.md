# Contributing

How changes get from an idea to production on this project. Every change follows the same flow, so `main` is always ready to deploy.

## Flow

1. **Pick a ticket** in Linear (team `REL`). Every change has a ticket.
2. **Branch from an up-to-date `main`**, named `type/REL-N-short-slug`:
   - `feature/` new functionality, `fix/` bug fixes, `chore/` tooling and setup, `docs/` documentation
   - example: `feature/REL-18-services-catalog`
   - Linear's "Copy git branch name" also works.
3. **Commit** with [Conventional Commits](https://www.conventionalcommits.org). The scope is the ticket ID:
   - `feat(REL-18): add service cards`
   - `fix(REL-19): validate the phone number`
   - Husky checks your message and runs ESLint and Prettier on the files you commit.
4. **Open a pull request** into `main`, using the template. The PR title must also follow Conventional Commits, because it becomes the commit message when the PR is squash-merged. Mention the ticket (for example `REL-18`) so Linear links it.
5. **Wait for the checks and the preview.** GitHub Actions runs lint, formatting, type check, unit tests, build and end-to-end tests. Vercel posts a preview link on the PR; check visual changes on desktop and on a phone.
6. **Squash and merge** once everything is green. The branch is deleted afterwards.
7. **Production deploys automatically** from `main` through Vercel.

## Working locally

Requirements: Node.js 22.12 or newer (see `.nvmrc`).

```bash
npm ci
npm run dev
```

Before you push, run the same checks as CI:

```bash
npm run lint
npm run format:check
npm run check
npm test
npm run test:e2e   # first time: npx playwright install chromium
```

`npm run lint:fix` and `npm run format` fix most problems automatically.

## Code standards

- JavaScript with JSDoc. Every exported function and component has a description, `@param` and `@returns`; data shapes use `@typedef`. ESLint enforces this.
- Add or update tests with the change. Unit tests sit next to the code (`*.test.js`); browser tests live in `tests/e2e/`.
- Keep pages accessible and usable on a phone.

## Secrets and personal data

- Never commit secrets, tokens, keys or personal data. Read settings from environment variables and add only the **names** to `.env.example`.
- `.env` files are ignored by Git. Real values are set in Vercel (Project Settings, Environment Variables).
- If you find a secret in the repository, stop, tell the owner, and rotate the credential first. Deleting it in a new commit does not remove it from the history.

## Dependencies

Dependabot opens weekly pull requests for npm packages and GitHub Actions. Review them like any other PR. ESLint stays on major version 9 until the React and accessibility plugins support ESLint 10.

## Repository settings (owner only)

These are set once in GitHub (Settings, Branches, branch protection rule or ruleset for `main`):

- Require a pull request before merging (0 required approvals is fine for a solo project)
- Require status checks to pass: **Quality checks**, **End-to-end tests**, **PR title**
- Block force pushes and branch deletion
- Allow squash merging only, and automatically delete head branches after merge (Settings, General)
