# ADR-005 Authentication for /admin: Clerk

Status: Accepted
Date: 2026-10-29
Tickets: REL-48, REL-41, REL-52

## Context

The owner needs a private area for analytics, conversations and controls. Building password handling, sessions and account recovery ourselves is risky and not the point of the project.

## Decision

- Use Clerk (`@clerk/astro`) for sign-in.
- Sign-in is restricted to an allowlist of emails (the owner only for now). Roles for staff can be added later without changing the flow.
- Every `/admin` page and every `/api/admin` route checks the session on the server; a missing or invalid session returns 401 or redirects. The client never decides access.
- Clerk keys are secrets; the publishable key is the only one that may be public.
- Two-step verification is required for the owner's account.

## Consequences

- Admin pages are on-demand routes and are never prerendered or cached publicly.
- There is a dependency on a third party for sign-in; its terms and free-plan limits must stay acceptable.

## Rejected alternatives

- **Own username and password:** more security work and more risk.
- **A shared secret URL or a static token:** cannot be revoked per person and leaks easily.
- **Cloudflare Access in front of /admin:** possible, but the admin pages need user identity in the code, and Clerk gives that directly.
