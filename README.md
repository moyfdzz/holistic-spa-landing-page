# Masajes Relax Monterrey

Website for a home massage and facial service in the Monterrey metropolitan area.

> The brand was renamed from the old "Rossy" name to "Masajes Relax Monterrey" (REL-12). Business data (name, phone, area, social links) lives in `src/config/site.js`. The GitHub repository and the Vercel project keep their old names until the domain move (REL-26). The refactor is tracked in the Linear project "Website Refactor 2026".

## Requirements

- Node.js 22.12 or newer (see `.nvmrc`)

## Getting started

```bash
npm ci
npm run dev      # development server
npm run build    # production build
npm run preview  # preview the production build
npm run check    # type-check Astro and JSDoc-typed JavaScript
npm run lint     # ESLint (Astro, React, accessibility, JSDoc rules)
npm run lint:fix # ESLint with automatic fixes
npm run format   # format everything with Prettier
npm run format:check # check formatting without changing files
```

## Stack

- [Astro](https://astro.build) with React islands (`@astrojs/react`)
- JavaScript with JSDoc, type-checked with `checkJs` (`jsconfig.json`)
- Deployed on Vercel (`@astrojs/vercel`)

## Project structure

```
public/            static files (favicon)
src/assets/        images (Astro creates resized WebP versions at build time)
src/pages/         routes (index, contact)
src/layouts/       shared page layout (fonts, global styles, header, footer)
src/components/    Astro components (Header, Footer, Hero, Button, Card, ...)
src/islands/       interactive React components
src/data/          content (services, FAQ, testimonials)
src/i18n/          translations
src/config/        site-wide settings
src/utils/         helpers (focus handling, reveal on scroll, dates)
src/scripts/       browser scripts for the header menu and the FAQ; the carousel
                   and contact form scripts are legacy code replaced by later tickets
src/styles/        design tokens (tokens.css) and global styles (global.css)
```

## Design system

- **Tokens** (`src/styles/tokens.css`): colors, fluid type scale, spacing, radius, shadows and motion. Components use the semantic names (`--color-primary`, `--color-text-muted`, ...) rather than raw colors.
- **Fonts** are self-hosted with Fontsource (Lora for headings, Quicksand for text).
- **Components** keep their own styles next to their markup. Page sections that appear on scroll use the `data-reveal` attribute.
- **Accessibility and motion:** every interactive element has a visible focus style, text colors meet WCAG AA contrast, and animations stop when the visitor prefers reduced motion.

## Testing

```bash
npm test                 # unit tests (Vitest + Testing Library, jsdom)
npm run test:watch       # unit tests in watch mode
npm run test:coverage    # unit tests with a coverage report
npm run test:e2e         # end-to-end tests (Playwright, desktop and phone sizes)
```

- Unit tests live next to the code as `*.test.js` / `*.test.jsx`.
- End-to-end tests live in `tests/e2e/`. They build the site and test the production output.
- The first time, install the browser Playwright uses: `npx playwright install chromium`.
- Test output (`coverage/`, `playwright-report/`, `test-results/`) is git-ignored.

## Code quality

- ESLint and Prettier run on staged files before every commit (Husky + lint-staged).
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org) and are checked by commitlint, for example `feat(REL-18): add service cards`. The scope is the Linear ticket ID.
- Copy `.env.example` to `.env` for local settings. Never commit real values; set them in Vercel.

## Workflow

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full flow (branches, commits, pull requests, checks and deployment).

One branch per Linear ticket, named `type/REL-N-short-slug` (for example `chore/REL-5-astro-setup`), merged through a pull request.
