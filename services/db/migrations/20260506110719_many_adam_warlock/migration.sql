CREATE TABLE "profiles_locations" (
	"profile_id" uuid,
	"location_id" uuid,
	CONSTRAINT "profiles_locations_pkey" PRIMARY KEY("profile_id","location_id")
);
--> statement-breakpoint
ALTER TABLE "profiles_locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "profiles_locations_location_id_index" ON "profiles_locations" ("location_id");--> statement-breakpoint
ALTER TABLE "profiles_locations" ADD CONSTRAINT "profiles_locations_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "profiles_locations" ADD CONSTRAINT "profiles_locations_location_id_locations_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "profiles_locations" AS PERMISSIVE FOR ALL TO "service_role";