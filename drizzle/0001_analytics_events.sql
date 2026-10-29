CREATE TABLE "analytics_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"visitor_id" text NOT NULL,
	"type" text NOT NULL,
	"path" text NOT NULL,
	"locale" text NOT NULL,
	"channel" text NOT NULL,
	"referrer_host" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"country" text,
	"region" text,
	"city" text,
	"device" text NOT NULL,
	"browser" text NOT NULL,
	"os" text NOT NULL,
	"screen" text NOT NULL,
	"props" jsonb
);
--> statement-breakpoint
CREATE TABLE "analytics_salts" (
	"day" date PRIMARY KEY NOT NULL,
	"salt" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_events_occurred_at_idx" ON "analytics_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_visitor_idx" ON "analytics_events" USING btree ("visitor_id","occurred_at");