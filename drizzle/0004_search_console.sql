CREATE TABLE "search_console_daily" (
	"day" date NOT NULL,
	"query" text NOT NULL,
	"page" text NOT NULL,
	"country" text NOT NULL,
	"device" text NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" double precision DEFAULT 0 NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "search_console_daily_day_query_page_country_device_pk" PRIMARY KEY("day","query","page","country","device")
);
--> statement-breakpoint
CREATE TABLE "search_console_totals" (
	"day" date PRIMARY KEY NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" double precision DEFAULT 0 NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL
);
