# ADR-008 Web analytics: first-party and cookieless

Status: Accepted
Date: 2026-10-29
Tickets: REL-49, REL-50, REL-51, REL-52

## Context

The owner wants to see how the website performs: visits, where they come from, what they read and whether they contact the business. Third-party analytics add cookies, consent banners and external data sharing.

## Decision

- A small first-party tracker sends events to `/api/collect`. It sets no cookies and stores no IP addresses or other identifiers that can single out a person.
- Events go to Postgres (ADR-002); a scheduled job (ADR-003) builds daily rollups, and raw events are removed after a retention period.
- Traffic sources use UTM parameters and the referrer; the owner adds UTM-tagged links to the business profiles.
- Search Console and Google Business Profile data are imported daily (REL-51) to cover what happens before the visit.
- A dashboard in `/admin` (REL-52) shows charts and numbers. Anonymous statistics are described in the privacy notice.
- The tracker is small and loads without hurting the Lighthouse budgets.

## Implementation notes

- The first slice (REL-49, collector and storage) keeps a single `analytics_events` table plus `analytics_salts`. There is no table partitioning and no `analytics_sessions` table yet: at this traffic an index on time is enough, and sessions (30 minutes without events) are derived from the events by the aggregation job (REL-50).
- The collector only accepts requests whose `Origin` is the production host, so previews, local runs and other sites never add data.
- The rate limit per IP is a Cloudflare rate limiting rule in the dashboard (owner step), plus a small body limit and strict validation in the code.
- Event names, fields and rules are in [../analytics.md](../analytics.md).

## Consequences

- No cookie banner is needed for the statistics.
- Numbers are anonymous and approximate: they cannot follow one visitor across days.

## Rejected alternatives

- **Google Analytics:** cookies, consent and data sent to a third party.
- **A hosted privacy-friendly service:** another account and bill for something the site can do itself with one table and a small job.
