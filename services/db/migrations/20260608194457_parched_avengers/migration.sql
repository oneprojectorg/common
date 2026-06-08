CREATE TYPE "moderation_flag_status" AS ENUM('flagged', 'confirmed', 'dismissed', 'disputed');--> statement-breakpoint
CREATE TYPE "moderation_item_type" AS ENUM('proposal', 'post', 'user');--> statement-breakpoint
CREATE TYPE "moderation_source" AS ENUM('automated', 'manual');--> statement-breakpoint
CREATE TABLE "moderation_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"item_type" "moderation_item_type" NOT NULL,
	"item_id" uuid NOT NULL,
	"status" "moderation_flag_status" DEFAULT 'flagged'::"moderation_flag_status" NOT NULL,
	"source" "moderation_source" DEFAULT 'automated'::"moderation_source" NOT NULL,
	"scores" jsonb,
	"reason" text,
	"external_record_id" text,
	"flagged_by_profile_id" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "moderation_flags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "moderation_flags_item_idx" ON "moderation_flags" ("item_type","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "moderation_flags_open_item_uniq" ON "moderation_flags" ("item_type","item_id") WHERE status = 'flagged';--> statement-breakpoint
CREATE INDEX "moderation_flags_item_status_created_at_idx" ON "moderation_flags" ("item_type","status","created_at");--> statement-breakpoint
CREATE INDEX "moderation_flags_status_created_at_idx" ON "moderation_flags" ("status","created_at");--> statement-breakpoint
CREATE INDEX "moderation_flags_flagged_by_idx" ON "moderation_flags" ("flagged_by_profile_id");--> statement-breakpoint
ALTER TABLE "moderation_flags" ADD CONSTRAINT "moderation_flags_flagged_by_profile_id_profiles_id_fkey" FOREIGN KEY ("flagged_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE POLICY "service-role" ON "moderation_flags" AS PERMISSIVE FOR ALL TO "service_role";