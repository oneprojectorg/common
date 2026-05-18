CREATE TABLE "resource_collection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"collection_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_by_profile_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "resource_collection_items_unq" UNIQUE("collection_id","resource_id")
);
--> statement-breakpoint
ALTER TABLE "resource_collection_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resource_collection_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"collection_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"added_by_profile_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "resource_collection_profiles_unq" UNIQUE("profile_id","collection_id")
);
--> statement-breakpoint
ALTER TABLE "resource_collection_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resource_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "resource_collections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"title" text NOT NULL,
	"description" text,
	"attachment_id" uuid,
	"link_url" text,
	"added_by_profile_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "resources_payload_check" CHECK ((("attachment_id" IS NOT NULL) <> ("link_url" IS NOT NULL)))
);
--> statement-breakpoint
ALTER TABLE "resources" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "resource_collection_items_order_idx" ON "resource_collection_items" ("collection_id","sort_order");--> statement-breakpoint
CREATE INDEX "resource_collection_profiles_order_idx" ON "resource_collection_profiles" ("profile_id","sort_order");--> statement-breakpoint
CREATE INDEX "resources_attachment_id_index" ON "resources" ("attachment_id");--> statement-breakpoint
ALTER TABLE "resource_collection_items" ADD CONSTRAINT "resource_collection_items_AZcKg7VjsCUS_fkey" FOREIGN KEY ("collection_id") REFERENCES "resource_collections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_collection_items" ADD CONSTRAINT "resource_collection_items_resource_id_resources_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_collection_items" ADD CONSTRAINT "resource_collection_items_9uSvnQWleOzW_fkey" FOREIGN KEY ("added_by_profile_user_id") REFERENCES "profile_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "resource_collection_profiles" ADD CONSTRAINT "resource_collection_profiles_1YgWXLGjGvGw_fkey" FOREIGN KEY ("collection_id") REFERENCES "resource_collections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_collection_profiles" ADD CONSTRAINT "resource_collection_profiles_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "resource_collection_profiles" ADD CONSTRAINT "resource_collection_profiles_XPjy8uKRYAwu_fkey" FOREIGN KEY ("added_by_profile_user_id") REFERENCES "profile_users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_attachment_id_attachments_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_added_by_profile_user_id_profile_users_id_fkey" FOREIGN KEY ("added_by_profile_user_id") REFERENCES "profile_users"("id") ON DELETE SET NULL;--> statement-breakpoint
CREATE POLICY "service-role" ON "resource_collection_items" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "resource_collection_profiles" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "resource_collections" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "resources" AS PERMISSIVE FOR ALL TO "service_role";