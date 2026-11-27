# ADR-004 LLM: Anthropic SDK, small model by default

Status: Rejected (2026-11-26)
Date: 2026-10-29
Tickets: REL-40, REL-43, REL-44, REL-69

> **Rejected on 2026-11-26:** there will be no website chat and no AI assistant; clients and the business owner talk on WhatsApp. Nothing described here was built. The text is kept as the record of what was considered.

## Context

The assistant answers short questions about one catalog (services, durations, policies) in Spanish and English. Answers must be grounded, and a wrong answer is worse than a hand-off to the owner.

## Decision

- Use the Anthropic SDK (`@anthropic-ai/sdk`) from `src/server/agent/`.
- The default model is `claude-haiku-5-5`. `claude-sonnet-5-5` is the step-up option. The model ID lives in configuration, not in code. Before launch, the evaluation (REL-43) runs on both models and the cheapest one that meets every threshold is kept; the result is recorded here.
- `claude-opus-5-5` is used only as the judge in evaluations, never in production.
- Structured outputs (`output_config.format`) with a schema, validated again with Zod on the server (ADR-006).
- Read-only tools only (`get_services`, `get_policies`, `get_faq`, `get_business_hours`), all backed by one `getCatalog()` so the site and the agent cannot disagree. The tools have `strict: true` and no side effects.
- Prompt caching: the stable system prompt and the catalog come first; the visitor message goes last.
- `output_config.effort` is set explicitly; refusals are handed off to the owner.
- Spend is limited in three layers: per session and per IP limits, a daily and monthly budget guard in code, and the monthly spend limit in the Anthropic Console as the hard ceiling.
- The API key is a secret and never reaches the browser, the logs or the repository. CI uses a different key with its own spend limit.

## Consequences

- Model, prompt version, tokens, cache use and latency are stored for every call (REL-45).
- Changing the prompt, the schema, the tools or the model requires the evaluation to pass (REL-44).

## Rejected alternatives

- **A frontier model for every reply:** slower and more expensive than short, grounded answers need.
- **Free-form text without a schema:** harder to check in code.
- **Letting the model call tools with side effects:** a jailbreak could then do something besides produce text.
