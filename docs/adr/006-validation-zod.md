# ADR-006 Validation: Zod at every boundary

Status: Accepted
Date: 2026-10-29
Tickets: REL-34, REL-40, REL-55

## Context

The project is JavaScript with JSDoc, so there are no compile-time types for data that comes from outside: environment variables, request bodies, database rows, model output and admin forms.

## Decision

- Use Zod to parse every value that crosses a boundary: environment variables at startup, request bodies, webhook payloads, model output (second validation after the structured output) and admin forms.
- Schemas live next to the code that owns the boundary, and JSDoc types are derived from them (`z.infer`) so there is one definition.
- A failed parse is a handled outcome (a 400 response, a hand-off, a logged error with no personal data), never an exception that leaks details.

## Consequences

- One small dependency, and a schema to write for each new boundary.
- Tests cover the schemas with valid and invalid examples.

## Rejected alternatives

- **TypeScript only:** it checks nothing at runtime.
- **Hand-written checks:** inconsistent and easy to forget.
