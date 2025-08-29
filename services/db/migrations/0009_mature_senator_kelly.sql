DROP INDEX "profiles_id_index";--> statement-breakpoint
DROP INDEX "profiles_slug_index";--> statement-breakpoint
DROP INDEX "profiles_updated_at_index";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "primary_location_id" uuid;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_primary_location_id_locations_id_fk" FOREIGN KEY ("primary_location_id") REFERENCES "public"."locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profiles_primary_location_idx" ON "profiles" USING btree ("primary_location_id");--> statement-breakpoint
CREATE INDEX "profiles_id_index" ON "profiles" USING btree ("id");--> statement-breakpoint
CREATE INDEX "profiles_slug_index" ON "profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "profiles_updated_at_index" ON "profiles" USING btree ("updated_at");