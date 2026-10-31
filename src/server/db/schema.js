/**
 * Database schema (Drizzle). Tables are added by the tickets that need them:
 * analytics (REL-49, REL-50), chat (REL-55), LLM calls (REL-40, REL-45).
 * @module server/db/schema
 */
import {
  bigserial,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  primaryKey,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Small key-value settings of the owner console (for example the chat on/off switch). */
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Salt of each day for the anonymous visitor ids. Rows older than today are deleted by the
 * daily job (REL-50), which is what makes the ids impossible to link across days.
 */
export const analyticsSalts = pgTable("analytics_salts", {
  day: date("day").primaryKey(),
  salt: text("salt").notNull(),
});

/**
 * One row per event sent by the tracker. No IP address, no cookie and no full user agent.
 * Sessions are derived from these rows by the aggregation job (REL-50).
 */
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    visitorId: text("visitor_id").notNull(),
    type: text("type").notNull(),
    path: text("path").notNull(),
    locale: text("locale").notNull(),
    channel: text("channel").notNull(),
    referrerHost: text("referrer_host"),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    country: text("country"),
    region: text("region"),
    city: text("city"),
    device: text("device").notNull(),
    browser: text("browser").notNull(),
    os: text("os").notNull(),
    screen: text("screen").notNull(),
    props: jsonb("props"),
  },
  (table) => [
    index("analytics_events_occurred_at_idx").on(table.occurredAt),
    index("analytics_events_visitor_idx").on(table.visitorId, table.occurredAt),
  ],
);

/**
 * Daily totals, one row per day, dimension and key (for example `channel` and `instagram`).
 * They are computed from `analytics_events` by the daily job and kept for good: they hold no
 * visitor ids. `dimension = "total"` has the numbers of the whole day.
 */
export const analyticsDaily = pgTable(
  "analytics_daily",
  {
    day: date("day").notNull(),
    dimension: text("dimension").notNull(),
    key: text("key").notNull(),
    visitors: integer("visitors").notNull().default(0),
    sessions: integer("sessions").notNull().default(0),
    pageViews: integer("page_views").notNull().default(0),
    events: integer("events").notNull().default(0),
    engagedSeconds: integer("engaged_seconds").notNull().default(0),
    bounces: integer("bounces").notNull().default(0),
  },
  (table) => [primaryKey({ columns: [table.day, table.dimension, table.key] })],
);

/**
 * Daily histograms of measures that cannot be added up as plain totals, like the active time of
 * a session or a Core Web Vital. `buckets` holds the count of samples per bucket (the bounds are
 * in `server/analytics/distribution.js`), so histograms of several days are summed and a
 * median or percentile of any range is read from the sum. They hold no visitor ids.
 */
export const analyticsDistributions = pgTable(
  "analytics_distributions",
  {
    day: date("day").notNull(),
    metric: text("metric").notNull(),
    samples: integer("samples").notNull().default(0),
    buckets: jsonb("buckets").notNull(),
  },
  (table) => [primaryKey({ columns: [table.day, table.metric] })],
);

/**
 * What Google Search Console says about the searches that showed the site, one row per day,
 * query, page, country and device (imported by the daily job, see `server/google`). Google
 * leaves out the anonymized queries here, so these rows add up to less than the real totals:
 * those are in `search_console_totals`. A `ctr` is a ratio from 0 to 1.
 */
export const searchConsoleDaily = pgTable(
  "search_console_daily",
  {
    day: date("day").notNull(),
    query: text("query").notNull(),
    page: text("page").notNull(),
    country: text("country").notNull(),
    device: text("device").notNull(),
    clicks: integer("clicks").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    ctr: doublePrecision("ctr").notNull().default(0),
    position: doublePrecision("position").notNull().default(0),
  },
  (table) => [
    primaryKey({
      columns: [
        table.day,
        table.query,
        table.page,
        table.country,
        table.device,
      ],
    }),
  ],
);

/**
 * The totals of each day as Search Console shows them in its own screen, with the anonymized
 * queries included. A day with no clicks or impressions has a row of zeros: it also marks the
 * day as imported, so a quiet day is not asked for again every night.
 */
export const searchConsoleTotals = pgTable("search_console_totals", {
  day: date("day").primaryKey(),
  clicks: integer("clicks").notNull().default(0),
  impressions: integer("impressions").notNull().default(0),
  ctr: doublePrecision("ctr").notNull().default(0),
  position: doublePrecision("position").notNull().default(0),
});
