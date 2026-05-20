CREATE TABLE "decision_process_survey_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"internal_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_process_survey_responses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_process_survey_submitters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"submitted_by_profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "dpss_instance_profile_unique" UNIQUE("process_instance_id","submitted_by_profile_id")
);
--> statement-breakpoint
ALTER TABLE "decision_process_survey_submitters" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "dpsr_process_instance_id_idx" ON "decision_process_survey_responses" ("process_instance_id");--> statement-breakpoint
CREATE INDEX "dpss_submitted_by_profile_id_idx" ON "decision_process_survey_submitters" ("submitted_by_profile_id");--> statement-breakpoint
ALTER TABLE "decision_process_survey_responses" ADD CONSTRAINT "decision_process_survey_responses_G7P11fwYgIjC_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_process_survey_submitters" ADD CONSTRAINT "decision_process_survey_submitters_5vk6LcGRGPJS_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_process_survey_submitters" ADD CONSTRAINT "decision_process_survey_submitters_sd5TlDdDSjqZ_fkey" FOREIGN KEY ("submitted_by_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_process_survey_responses" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_process_survey_submitters" AS PERMISSIVE FOR ALL TO "service_role";