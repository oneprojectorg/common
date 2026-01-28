ALTER TABLE "access_roles" DROP CONSTRAINT "access_roles_name_unique";--> statement-breakpoint
ALTER TABLE "access_roles" ADD COLUMN "profile_id" uuid;--> statement-breakpoint
ALTER TABLE "access_roles" ADD CONSTRAINT "access_roles_name_profile_unique" UNIQUE NULLS NOT DISTINCT("name","profile_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "access_roles_profile_id_idx" ON "access_roles" ("profile_id");--> statement-breakpoint
ALTER TABLE "access_roles" ADD CONSTRAINT "access_roles_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;