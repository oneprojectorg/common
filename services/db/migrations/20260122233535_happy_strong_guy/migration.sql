ALTER TABLE "locations" ALTER COLUMN "location" SET DATA TYPE geometry(point,4326) USING "location"::geometry(point,4326);--> statement-breakpoint
ALTER TABLE "locations" RENAME CONSTRAINT "locations_placeId_unique" TO "locations_place_id_key";--> statement-breakpoint
CREATE INDEX "profileUsers_email_trgm_idx" ON "profile_users" USING gin ("email" extensions.gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "profiles_name_trgm_idx" ON "profiles" USING gin ("name" extensions.gin_trgm_ops);
