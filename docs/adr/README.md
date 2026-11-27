# Architecture decision records

Each file records one decision: what was decided, why, and what was rejected. They are short on purpose. When a decision changes, write a new record that replaces the old one and mark the old one as `Superseded`, instead of editing history. A decision dropped with nothing to replace it, before anything was built, is marked `Rejected` and kept. A record may be edited to remove parts that were dropped and never built; an `Updated` line says what changed and when.

| ADR                                      | Decision                                               | Status   |
| ---------------------------------------- | ------------------------------------------------------ | -------- |
| [001](001-runtime-cloudflare-workers.md) | Astro on-demand routes on Cloudflare Workers           | Accepted |
| [002](002-database-postgres-drizzle.md)  | Postgres on Neon with Drizzle and versioned migrations | Accepted |
| [003](003-request-flow-and-cron.md)      | Scheduled jobs: one Cron Trigger handler               | Accepted |
| [004](004-llm-anthropic.md)              | Anthropic SDK, small model by default, strict tools    | Rejected |
| [005](005-admin-auth-clerk.md)           | Clerk for the owner-only `/admin`                      | Accepted |
| [006](006-validation-zod.md)             | Zod at every boundary                                  | Accepted |
| [007](007-assistant-policy.md)           | Assistant policy: website chat only, code decides      | Rejected |
| [008](008-web-analytics-first-party.md)  | First-party, cookieless web analytics                  | Accepted |

How the pieces fit together is in [../architecture.md](../architecture.md). How tickets are executed with Claude Code is in [../ai-workflow.md](../ai-workflow.md).

## Format

```
# ADR-NNN Title

Status: Accepted | Rejected (YYYY-MM-DD) | Superseded by ADR-NNN
Date: YYYY-MM-DD
Updated: YYYY-MM-DD (REL-N). What changed. (only if edited later)
Tickets: REL-N

## Context
## Decision
## Consequences
## Rejected alternatives
```
