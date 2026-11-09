CREATE TABLE "decision_form_schemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"schema" jsonb NOT NULL,
	"created_by_profile_id" uuid,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text)
);
--> statement-breakpoint
ALTER TABLE "decision_form_schemas" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD COLUMN "form_schema_id" uuid;--> statement-breakpoint
CREATE INDEX "decision_form_schemas_process_instance_id_index" ON "decision_form_schemas" ("process_instance_id");--> statement-breakpoint
CREATE INDEX "decision_proposals_form_schema_id_index" ON "decision_proposals" ("form_schema_id");--> statement-breakpoint
ALTER TABLE "decision_form_schemas" ADD CONSTRAINT "decision_form_schemas_kZh2uwArMRia_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_form_schemas" ADD CONSTRAINT "decision_form_schemas_created_by_profile_id_profiles_id_fkey" FOREIGN KEY ("created_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD CONSTRAINT "decision_proposals_form_schema_id_decision_form_schemas_id_fkey" FOREIGN KEY ("form_schema_id") REFERENCES "decision_form_schemas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_form_schemas" AS PERMISSIVE FOR ALL TO "service_role";