/**
 * The body the tracker sends to `/api/collect`, and what is stored per event.
 * The event names are listed in docs/analytics.md.
 * @module server/analytics/events
 */
import { z } from "zod";

/** Every event name the collector accepts. Anything else is rejected. */
export const eventTypes = /** @type {const} */ ([
  "page_view",
  "engagement",
  "section_view",
  "contact_view",
  "form_start",
  "form_submit",
  "form_success",
  "form_error",
  "whatsapp_click",
  "phone_click",
  "email_click",
  "social_click",
  "language_switch",
  "service_card_view",
  "faq_open",
  "web_vital",
]);

const short = (/** @type {number} */ max) => z.string().max(max);

/** Schema of the request body. Unknown keys are dropped. */
export const collectBodySchema = z.object({
  type: z.enum(eventTypes),
  path: short(200).startsWith("/"),
  locale: z.enum(["es", "en"]),
  referrer: short(300).optional(),
  utmSource: short(80).optional(),
  utmMedium: short(80).optional(),
  utmCampaign: short(80).optional(),
  screenWidth: z.number().int().min(0).max(10000).optional(),
  props: z
    .record(short(40), z.union([short(100), z.number(), z.boolean()]))
    .refine((value) => Object.keys(value).length <= 8, "too many props")
    .optional(),
});

/** @typedef {z.infer<typeof collectBodySchema>} CollectBody */

/**
 * Buckets a screen width so the exact size is not stored.
 * @param {number | undefined} width - Width in CSS pixels.
 * @returns {"small" | "medium" | "large" | "unknown"} The bucket.
 */
export function screenBucket(width) {
  if (width === undefined) return "unknown";
  if (width < 600) return "small";
  if (width < 1024) return "medium";
  return "large";
}
