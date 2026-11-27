# ADR-003 Scheduled jobs: one Cron Trigger handler

Status: Accepted
Date: 2026-10-29
Updated: 2026-11-26 (REL-69). The website chat was dropped ([ADR-007](007-assistant-policy.md)), so the part about its synchronous API was removed; it was never built.
Tickets: REL-50, REL-51

## Context

Some work is periodic and does not belong to a request: analytics rollups, retention and Google imports.

## Decision

- All scheduled work runs from one Cloudflare Cron Trigger handler (`src/worker.js`, `scheduled`) that dispatches to small jobs (rollups, retention, Google imports). Today there is one daily trigger, which runs the analytics job and then the Google import. The free plan allows 5 Cron Triggers per account and 15 minutes per run; one handler leaves room for other projects.
- Work that can finish after a response may use `waitUntil`, which the free plan allows for up to 30 seconds.

## Consequences

- Jobs must be idempotent and safe to run twice, because a cron run can be retried.

## Rejected alternatives

- **A queue and a worker per job:** more moving parts than a one-person business needs.
