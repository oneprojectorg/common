DROP INDEX "decision_boundaries_name_unique";--> statement-breakpoint
ALTER TABLE "decision_boundaries" ADD COLUMN "profile_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "decision_boundaries_profile_id_name_unique" ON "decision_boundaries" ("profile_id",lower("name"));--> statement-breakpoint
CREATE INDEX "decision_boundaries_profile_id_index" ON "decision_boundaries" ("profile_id");--> statement-breakpoint
ALTER TABLE "decision_boundaries" ADD CONSTRAINT "decision_boundaries_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;