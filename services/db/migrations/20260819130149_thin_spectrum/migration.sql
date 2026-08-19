CREATE TYPE "proposal_export_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "proposal_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"requested_by_user_id" uuid,
	"format" text NOT NULL,
	"status" "proposal_export_status" DEFAULT 'pending'::"proposal_export_status" NOT NULL,
	"file_name" text,
	"signed_url" text,
	"url_expires_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text) NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "proposal_exports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "proposal_exports_process_instance_id_index" ON "proposal_exports" ("process_instance_id");--> statement-breakpoint
ALTER TABLE "proposal_exports" ADD CONSTRAINT "proposal_exports_id9bJzD6JzaO_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "proposal_exports" ADD CONSTRAINT "proposal_exports_requested_by_user_id_users_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "proposal_exports" AS PERMISSIVE FOR ALL TO "service_role";