# ADR-007 Assistant policy: website chat only, the code decides

Status: Accepted
Date: 2026-10-29
Tickets: REL-35, REL-36, REL-40, REL-55, REL-56, REL-57

## Context

The owner wants quick answers for visitors without losing control of what is promised. WhatsApp is how the owner talks to clients and stays manual. An assistant that invents a price or a time, answers off-topic requests or can be talked into anything would hurt the business.

## Decision

**Where it lives.** The assistant lives in a chat bubble on the website (desktop and phone). WhatsApp is never automated; the chat hands off with a "Continuar por WhatsApp" button that opens `wa.me` with a prefilled summary.

**The model proposes, the code decides.** A reply is shown only if the code approves it:

- The output is valid against the schema, and `stop_reason` is a normal end.
- The intent is in an allowlist (`service_info`, `location_coverage`, `policy`, `availability_booking`), no owner attention is needed and confidence is high.
- No amount or currency appears in the reply, every duration matches the catalog, and the language matches the visitor.
- Otherwise the visitor gets a short message and the WhatsApp button.

**Decisions from the owner that the chat respects:**

- **No prices** anywhere, on the site or in the chat. Price questions get a friendly fixed answer and the WhatsApp button.
- **Extra charges** (some zones, a cancellation without rescheduling) are explained in words; amounts are given over WhatsApp.
- **Payment details** (bank account, PayPal link) are never shown on the site or in the chat; the owner sends them over WhatsApp once an appointment is confirmed.
- **Coverage** comes from the catalog. A municipality that is not listed is handed off.
- **Professional, therapeutic massage only.** Any request for erotic or sexual services gets a fixed reply that does not go through the model, and the conversation is flagged for the owner.
- **Health questions and complaints** are handed off to the owner. The assistant gives no medical advice.
- **Missing data** (a topic with no catalog entry) is never guessed; it is handed off.
- **Availability:** the assistant collects the preferred time but never confirms an appointment.

**Scope and abuse.** The assistant only talks about the business. For `off_topic`, the model's text never reaches the client; the code sends a fixed template. There are checks on length, code-like content and links; per-session and per-IP limits; Cloudflare Turnstile; a daily and monthly budget guard; and a kill switch (`CHAT_ENABLED`, also a toggle in `/admin`). After three off-topic messages the session closes with the WhatsApp button.

**Privacy.** The chat says it is a virtual assistant, asks visitors not to share sensitive health details and links to the privacy notice (REL-35).

## Consequences

- Behavior changes mostly by changing catalog data, not code.
- Every decision (`answered`, `handed_off`, `off_topic`) and the guardrail that failed is stored for metrics and evaluations.
- The evaluation set (REL-43) includes the cases above: price questions, off-topic requests, injection attempts, sexual requests, health questions, out-of-zone addresses and very long messages.

## Rejected alternatives

- **A WhatsApp Business Platform bot:** the owner does not want automated WhatsApp replies, and it needs a Meta account.
- **Letting the model's text through with a post-hoc filter only:** safer to require that the code approves each answer.
