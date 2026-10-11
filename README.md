# Masajes Relax Monterrey

Website for a home massage and facial service in the Monterrey metropolitan area.

> The brand is still being renamed from "Masajes Holísticos Rossy". The refactor is tracked in the Linear project "Website Refactor 2026".

## Requirements

- Node.js 22 or newer (see `.nvmrc`)

## Getting started

```bash
npm ci
npm run dev      # development server
npm run build    # production build
npm run preview  # preview the production build
npm run check    # type-check Astro and JSDoc-typed JavaScript
```

## Stack

- [Astro](https://astro.build) with React islands (`@astrojs/react`)
- JavaScript with JSDoc, type-checked with `checkJs` (`jsconfig.json`)
- Deployed on Vercel (`@astrojs/vercel`)

## Project structure

```
public/            static files (favicon, images)
src/pages/         routes (index, contact)
src/layouts/       shared page layouts
src/components/    Astro components
src/islands/       interactive React components
src/data/          content (services, FAQ, testimonials)
src/i18n/          translations
src/config/        site-wide settings
src/utils/         helpers
src/styles/        stylesheets
src/scripts/       legacy browser script, replaced piece by piece
```

## Workflow

One branch per Linear ticket, named `type/REL-N-short-slug` (for example `chore/REL-5-astro-setup`), merged through a pull request.
