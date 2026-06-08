CREATE TYPE "moderation_record_status" AS ENUM('flagged', 'upheld', 'dismissed', 'disputed');--> statement-breakpoint
CREATE TYPE "moderation_source" AS ENUM('automated', 'manual');--> statement-breakpoint
CREATE TYPE "moderation_subject_type" AS ENUM('proposal', 'post', 'user');--> statement-breakpoint
CREATE TABLE "moderation_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"subject_type" "moderation_subject_type" NOT NULL,
	"subject_id" uuid NOT NULL,
	"status" "moderation_record_status" DEFAULT 'flagged'::"moderation_record_status" NOT NULL,
	"source" "moderation_source" DEFAULT 'automated'::"moderation_source" NOT NULL,
	"scores" jsonb,
	"reason" text,
	"provider_name" text,
	"provider_record_id" text,
	"provider_url" text,
	"flagged_by_profile_id" uuid,
	"reviewed_by_profile_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "moderation_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "moderation_hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD COLUMN "moderation_hidden_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "moderation_hidden_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "moderation_records_subject_idx" ON "moderation_records" ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "moderation_records_open_subject_idx" ON "moderation_records" ("subject_type","subject_id") WHERE status = 'flagged';--> statement-breakpoint
CREATE INDEX "moderation_records_status_idx" ON "moderation_records" ("status");--> statement-breakpoint
CREATE INDEX "moderation_records_created_at_idx" ON "moderation_records" ("created_at");--> statement-breakpoint
CREATE INDEX "moderation_records_flagged_by_idx" ON "moderation_records" ("flagged_by_profile_id");--> statement-breakpoint
CREATE INDEX "moderation_records_reviewed_by_idx" ON "moderation_records" ("reviewed_by_profile_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "posts_moderation_hidden_at_idx" ON "posts" ("moderation_hidden_at");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "proposals_moderation_hidden_at_idx" ON "decision_proposals" ("moderation_hidden_at");--> statement-breakpoint
ALTER TABLE "moderation_records" ADD CONSTRAINT "moderation_records_flagged_by_profile_id_profiles_id_fkey" FOREIGN KEY ("flagged_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "moderation_records" ADD CONSTRAINT "moderation_records_reviewed_by_profile_id_profiles_id_fkey" FOREIGN KEY ("reviewed_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE POLICY "service-role" ON "moderation_records" AS PERMISSIVE FOR ALL TO "service_role";