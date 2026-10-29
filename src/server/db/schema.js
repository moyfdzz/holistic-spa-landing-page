/**
 * Database schema (Drizzle). Tables are added by the tickets that need them:
 * analytics (REL-49, REL-50), chat (REL-55), LLM calls (REL-40, REL-45).
 * @module server/db/schema
 */
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Small key-value settings of the owner console (for example the chat on/off switch). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
