ALTER TABLE "decision_process_instances" ADD COLUMN "steward_profile_id" uuid;--> statement-breakpoint
CREATE INDEX "decision_process_instances_steward_profile_id_index" ON "decision_process_instances" ("steward_profile_id");--> statement-breakpoint
ALTER TABLE "decision_process_instances" ADD CONSTRAINT "decision_process_instances_steward_profile_id_profiles_id_fkey" FOREIGN KEY ("steward_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
