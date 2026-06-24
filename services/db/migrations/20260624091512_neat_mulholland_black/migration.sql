CREATE TABLE "event_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"event_name" text NOT NULL,
	"event_data" jsonb NOT NULL,
	"delivered_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "event_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "event_outbox_undelivered_idx" ON "event_outbox" ("created_at") WHERE "delivered_at" IS NULL;--> statement-breakpoint
CREATE POLICY "service-role" ON "event_outbox" AS PERMISSIVE FOR ALL TO "service_role";