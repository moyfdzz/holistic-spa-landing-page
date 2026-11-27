# ADR-006 Validation: Zod at every boundary

Status: Accepted
Date: 2026-10-29
Updated: 2026-11-26 (REL-69). The AI assistant and the Stripe deposit were dropped, so model output and webhooks were removed.
Tickets: REL-34

## Context

The project is JavaScript with JSDoc, so there are no compile-time types for data that comes from outside: environment variables, request bodies, database rows, answers of outside services and admin forms.

## Decision

- Use Zod to parse every value that crosses a boundary: environment variables at startup, request bodies, answers of outside services and admin forms.
- Schemas live next to the code that owns the boundary, and JSDoc types are derived from them (`z.infer`) so there is one definition.
- A failed parse is a handled outcome (a 400 response, a logged error with no personal data), never an exception that leaks details.

## Consequences

- One small dependency, and a schema to write for each new boundary.
- Tests cover the schemas with valid and invalid examples.

## Rejected alternatives

- **TypeScript only:** it checks nothing at runtime.
- **Hand-written checks:** inconsistent and easy to forget.
