CREATE TABLE "rate_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"source_name" text NOT NULL,
	"rate" numeric(10, 4) NOT NULL,
	"recorded_at" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_history_event_source_date_unique" UNIQUE("event_id","source_name","recorded_at")
);
--> statement-breakpoint
ALTER TABLE "rate_history" ADD CONSTRAINT "rate_history_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rate_history_event_id_idx" ON "rate_history" USING btree ("event_id");