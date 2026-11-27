# Architecture

One Astro project, deployed as one Cloudflare Worker. Public pages are static files; the server parts are on-demand routes in the same Worker. Decisions and rejected alternatives are in [adr/](adr/README.md).

The public site, the analytics collector, its daily job and the `/admin` area are built and deployed. The Google data is not complete: the Search Console import needs its settings in production, the Business Profile import is not built (REL-51, see [google-data.md](google-data.md)) and the dashboard does not show Google data yet (REL-52). Clients contact the business on WhatsApp, by phone, by email or with the contact form; there is no website chat.

## Analytics (REL-49, REL-50, REL-51, REL-52)

```mermaid
flowchart LR
  P[Pages] -->|tiny tracker, no cookies| C[/api/collect]
  C --> E[(events)]
  E --> J[Cron job: daily rollups and retention]
  J --> D[(daily rollups)]
  G1[Search Console] --> J2[Cron job: daily import]
  G2[Business Profile] --> J2
  J2 --> D
  D --> Q[Query API]
  Q --> B[/admin dashboard, Clerk sign-in/]
```

## Owner console (REL-48)

```mermaid
flowchart LR
  Ow[Owner] --> Cl[Clerk sign-in, email allowlist]
  Cl --> Ad[/admin]
  Ad --> S[Analytics dashboard]
```

## Where the code lives

| Area                       | Folder                                                  |
| -------------------------- | ------------------------------------------------------- |
| Public pages and views     | `src/pages/`, `src/views/`                              |
| Business facts and catalog | `src/config/`, `src/data/`                              |
| Server code                | `src/server/` (env, db, admin, analytics, google, jobs) |
| API routes                 | `src/pages/api/` (`prerender = false`)                  |
| Migrations                 | `drizzle/`                                              |
| Hosting and headers        | `wrangler.jsonc`, `public/_headers`                     |

## Environments

- **Production:** `www.masajesrelaxmty.com`, built from `main` by Cloudflare Workers Builds.
- **Previews:** one URL per branch, built by the same service.
- **Local:** `npm run dev`; real client messages and real API keys are never used in local data or tests.
