CREATE TYPE "proposal_theme_analysis_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "proposal_theme_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"requested_by_auth_user_id" uuid NOT NULL,
	"status" "proposal_theme_analysis_status" DEFAULT 'pending'::"proposal_theme_analysis_status" NOT NULL,
	"result" jsonb,
	"analyzed_count" integer,
	"total" integer,
	"error_code" text,
	"error_message" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "proposal_theme_analyses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "proposal_theme_analyses_instance_created_idx" ON "proposal_theme_analyses" ("process_instance_id","created_at");--> statement-breakpoint
ALTER TABLE "proposal_theme_analyses" ADD CONSTRAINT "proposal_theme_analyses_FxsWjaK2DvkH_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "proposal_theme_analyses" ADD CONSTRAINT "proposal_theme_analyses_requested_by_auth_user_id_users_id_fkey" FOREIGN KEY ("requested_by_auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "proposal_theme_analyses" AS PERMISSIVE FOR ALL TO "service_role";