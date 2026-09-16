CREATE TABLE "decision_process_phases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"sort_order" integer NOT NULL,
	"profile_id" uuid NOT NULL,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_process_phases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "dpp_instance_sort_idx" ON "decision_process_phases" ("process_instance_id","sort_order");--> statement-breakpoint
CREATE INDEX "dpp_profile_idx" ON "decision_process_phases" ("profile_id");--> statement-breakpoint
ALTER TABLE "decision_process_phases" ADD CONSTRAINT "decision_process_phases_Llk5Bo7Xklsd_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_process_phases" ADD CONSTRAINT "decision_process_phases_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_process_phases" AS PERMISSIVE FOR ALL TO "service_role";