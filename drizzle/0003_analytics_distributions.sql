CREATE TABLE "analytics_distributions" (
	"day" date NOT NULL,
	"metric" text NOT NULL,
	"samples" integer DEFAULT 0 NOT NULL,
	"buckets" jsonb NOT NULL,
	CONSTRAINT "analytics_distributions_day_metric_pk" PRIMARY KEY("day","metric")
);
