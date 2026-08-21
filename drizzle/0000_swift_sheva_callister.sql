CREATE TYPE "public"."event_type" AS ENUM('exchange_rate', 'weather_task');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('sent', 'failed');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "event_type" NOT NULL,
	"config" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"recipient_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "household_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" text NOT NULL,
	"interval_days" integer NOT NULL,
	"weather_rules" jsonb NOT NULL,
	"last_done_at" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"subject" text,
	"body" text,
	"status" "notification_status" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"ran_at" timestamp with time zone DEFAULT now() NOT NULL,
	"triggered" boolean NOT NULL,
	"raw_result" jsonb
);
--> statement-breakpoint
ALTER TABLE "household_tasks" ADD CONSTRAINT "household_tasks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_log" ADD CONSTRAINT "run_log_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_is_active_idx" ON "events" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "household_tasks_event_id_idx" ON "household_tasks" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "notification_log_event_id_idx" ON "notification_log" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "run_log_event_id_idx" ON "run_log" USING btree ("event_id");