CREATE TABLE "moderation_webhook_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"provider" text NOT NULL,
	"delivery_id" text NOT NULL,
	"raw_body" text NOT NULL,
	"headers" jsonb NOT NULL,
	"received_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"processed_at" timestamp with time zone,
	"processed_status" text
);
--> statement-breakpoint
ALTER TABLE "moderation_webhook_inbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_webhook_inbox_provider_delivery_uniq" ON "moderation_webhook_inbox" ("provider","delivery_id");--> statement-breakpoint
CREATE INDEX "moderation_webhook_inbox_pending_idx" ON "moderation_webhook_inbox" ("received_at") WHERE processed_at IS NULL;--> statement-breakpoint
CREATE POLICY "service-role" ON "moderation_webhook_inbox" AS PERMISSIVE FOR ALL TO "service_role";