# ADR-003 Request flow and scheduled jobs

Status: Accepted
Date: 2026-10-29
Tickets: REL-55, REL-40, REL-50

## Context

The website chat sends a visitor message and expects an answer in a few seconds. The text of a model must never reach the visitor before the code has checked it. Other work (analytics rollups, retention, Google imports) is periodic.

## Decision

- `POST /api/chat` answers synchronously: validate the request, call the agent, run every guardrail, then return the answer or a hand-off. The unvalidated text of a model is never streamed. The widget shows a typing indicator while it waits.
- Each visitor message has a `messageId`; a retried request returns the stored answer and never makes a second model call.
- All scheduled work runs from one Cloudflare Cron Trigger handler (`src/worker.js`, `scheduled`) that dispatches to small jobs (rollups, retention, Google imports). Today there is one daily trigger that runs the analytics job. The free plan allows 5 Cron Triggers per account and 15 minutes per run; one handler leaves room for other projects.
- Work that can finish after the response (for example storing metrics) uses `waitUntil`, which the free plan allows for up to 30 seconds.

## Consequences

- Latency is the model's latency plus validation. The default model is a small one for that reason (ADR-004).
- Jobs must be idempotent and safe to run twice, because a cron run can be retried.

## Rejected alternatives

- **Streaming tokens to the browser:** it would show text before the guardrails have approved it.
- **A queue and a worker per job:** more moving parts than a one-person business needs.
