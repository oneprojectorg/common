ALTER TABLE "profiles_locations" ADD COLUMN "created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text);--> statement-breakpoint
ALTER TABLE "profiles_locations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text);--> statement-breakpoint
ALTER TABLE "profiles_locations" ADD COLUMN "deleted_at" timestamp with time zone;
