# ADR-002 Database: Postgres on Neon with Drizzle

Status: Accepted
Date: 2026-10-29
Tickets: REL-34, REL-49, REL-55

## Context

Chat sessions and messages, analytics events and their daily rollups, imports from Google and settings all need storage. Several of them need relations, unique constraints (for idempotent retries) and aggregate queries.

## Decision

- Postgres on a Neon account (free plan), with a database branch for previews and CI.
- A serverless driver that works over HTTP or WebSocket from Workers.
- Drizzle ORM for typed queries and Drizzle Kit for versioned SQL migrations, committed to the repository and applied in a controlled step, never by hand in production.
- Connection strings are secrets (Worker secrets, GitHub secrets for CI). They never appear in code, logs or fixtures.
- Message bodies have a retention period decided with the owner (REL-35) and a scheduled job to purge or anonymize them.

## Consequences

- Idempotency (`message_id` unique), counters and rollups are plain SQL.
- Every schema change is a reviewed migration. Tests that need a database use a Neon branch or a local Postgres, never real client data.
- Neon free-plan limits (storage, compute hours) must be watched in the observability work (REL-45).

## Rejected alternatives

- **Workers KV:** no relations or unique constraints, eventual consistency, poor for aggregates.
- **D1 (SQLite):** workable, but Postgres gives better tooling, branching for previews and an easier path if the project grows.
- **Vercel Marketplace databases:** the project no longer runs on Vercel.
