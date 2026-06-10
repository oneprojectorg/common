CREATE TYPE "moderation_submission_verdict" AS ENUM('pending', 'flagged', 'clear');--> statement-breakpoint
ALTER TYPE "moderation_flag_status" ADD VALUE 'pending' BEFORE 'flagged';--> statement-breakpoint
CREATE TABLE "moderation_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"item_type" "moderation_item_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"media_id" text NOT NULL,
	"verdict" "moderation_submission_verdict" DEFAULT 'pending'::"moderation_submission_verdict" NOT NULL,
	"scores" jsonb,
	"reason" text,
	"external_record_id" text,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text)
);
--> statement-breakpoint
ALTER TABLE "moderation_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "moderation_flags_open_item_uniq";--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_flags_open_item_uniq" ON "moderation_flags" ("item_type","item_id") WHERE status NOT IN ('confirmed', 'dismissed', 'disputed');--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_submissions_item_media_uniq" ON "moderation_submissions" ("item_type","item_id","media_id");--> statement-breakpoint
CREATE POLICY "service-role" ON "moderation_submissions" AS PERMISSIVE FOR ALL TO "service_role";