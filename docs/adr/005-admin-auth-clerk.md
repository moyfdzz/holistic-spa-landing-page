# ADR-005 Authentication for /admin: Clerk

Status: Accepted
Date: 2026-10-29
Updated: 2026-11-26 (REL-69). The area is for website and Google statistics only, and two-step verification moved to the owner's email account.
Tickets: REL-48, REL-52, REL-62, REL-69

## Context

The owner needs a private area for website and Google statistics. Building password handling, sessions and account recovery ourselves is risky and not the point of the project.

## Decision

- Use Clerk for sign-in, on the server only (`@clerk/backend`): the site loads no Clerk script.
- The live site uses the production instance and local development uses the development instance; the keys of the two are never mixed.
- Sign-in is restricted to an allowlist of emails (the owner only for now). Roles for staff can be added later without changing the flow.
- Every `/admin` page and every `/api/admin` route checks the session on the server; a missing or invalid session returns 401 or redirects. The client never decides access.
- Clerk keys are secrets; the publishable key is the only one that may be public.
- The site stays on Clerk's free plan, which does not include multi-factor authentication (MFA) in production: MFA is in the Pro plan, 25 USD per month or 20 billed annually ([clerk.com/pricing](https://clerk.com/pricing), read 2026-11-26).
- Instead, the owner turns on two-step verification on the email account that receives the sign-in code. The code of the site cannot check this.

## Consequences

- Admin pages are on-demand routes and are never prerendered or cached publicly.
- There is a dependency on a third party for sign-in; its terms and free-plan limits must stay acceptable.
- The sign-in to `/admin` is only as strong as the protection of that email account.

## Rejected alternatives

- **Clerk Pro to get MFA:** a monthly cost for an area with one user that shows anonymous statistics.
- **Own username and password:** more security work and more risk.
- **A shared secret URL or a static token:** cannot be revoked per person and leaks easily.
- **Cloudflare Access in front of /admin:** possible, but the admin pages need user identity in the code, and Clerk gives that directly.
