# Changelog

All notable changes to the website. Versions follow [Semantic Versioning](https://semver.org).

## 2.0.0 - 2026-10-12

A full rebuild of the Masajes Relax Monterrey website: new brand, new look, Spanish and English, and a new address.

### What visitors get

- **New brand and address:** "Masajes Relax Monterrey" at https://www.masajesrelaxmty.com. The old addresses (`masajesrelaxmty.vercel.app` and `masajes-rossy.vercel.app`) redirect permanently to it.
- **Spanish and English:** every page exists in both languages (`/` and `/en/`), with a language switch and a suggestion for English-speaking visitors.
- **10 services**, each with its lengths: massages in 60, 90 or 120 minutes, facials in 60, and the new craniofacial massage and foot and hand reflexology in 15 or 30 minutes.
- **A consistent set of illustrations** for the hero, the "why choose us" section, every service and the image shown when the site is shared.
- **Contact form** with clear messages in the visitor's language, a confirmation window after sending, and a WhatsApp fallback. A floating WhatsApp button and quote links on each service.
- **FAQ, privacy notice (draft), opening hours, service area and social links.**
- **Works well on phones, tablets and desktops,** with a phone carousel for the services and no sideways scrolling elsewhere.

### Under the hood

- Astro with React islands, deployed on Vercel from `main`.
- All business data (name, phone, hours, address, social links) in one file: `src/config/site.js`. Texts in `src/i18n/`, content in `src/data/`.
- Search engine basics: titles, descriptions, canonical and language links, sitemap, `robots.txt`, structured data for the business and the FAQ, Google Search Console verified.
- Automatic checks on every pull request: lint, formatting, types, unit tests, end-to-end and accessibility tests on desktop and phone, and Lighthouse budgets (performance, accessibility, best practices and SEO scores above 90, loading-time and layout-shift limits).
- Production measured on release: Lighthouse 100 in all four categories, main content in 1.4 to 1.7 s, no layout shift.

### Known pending items

- The testimonials section is built but hidden until there are real testimonials with consent (REL-22).
- The privacy notice is a draft and should be reviewed by someone with legal knowledge.
- Screen-reader and real-device accessibility checks are done by the owner (REL-24).
