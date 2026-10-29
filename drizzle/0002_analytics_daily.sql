CREATE TABLE "analytics_daily" (
	"day" date NOT NULL,
	"dimension" text NOT NULL,
	"key" text NOT NULL,
	"visitors" integer DEFAULT 0 NOT NULL,
	"sessions" integer DEFAULT 0 NOT NULL,
	"page_views" integer DEFAULT 0 NOT NULL,
	"events" integer DEFAULT 0 NOT NULL,
	"engaged_seconds" integer DEFAULT 0 NOT NULL,
	"bounces" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "analytics_daily_day_dimension_key_pk" PRIMARY KEY("day","dimension","key")
);
