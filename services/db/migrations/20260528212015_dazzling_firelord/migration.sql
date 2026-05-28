ALTER TABLE "resource_collection_items" DROP CONSTRAINT IF EXISTS "resource_collection_items_9uSvnQWleOzW_fkey";--> statement-breakpoint
ALTER TABLE "resource_collection_profiles" DROP CONSTRAINT IF EXISTS "resource_collection_profiles_XPjy8uKRYAwu_fkey";--> statement-breakpoint
ALTER TABLE "resource_collections" DROP CONSTRAINT IF EXISTS "resource_collections_VUNYELhkilWW_fkey";--> statement-breakpoint
ALTER TABLE "resources" DROP CONSTRAINT IF EXISTS "resources_added_by_profile_user_id_profile_users_id_fkey";--> statement-breakpoint
DROP INDEX IF EXISTS "resources_added_by_profile_user_id_index";--> statement-breakpoint
ALTER TABLE "resource_collection_items" ADD COLUMN "sort_key" text COLLATE "C" NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_collection_items" ADD COLUMN "added_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "resource_collection_profiles" ADD COLUMN "sort_key" text COLLATE "C" NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_collection_profiles" ADD COLUMN "added_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "resource_collections" ADD COLUMN "added_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "resources" ADD COLUMN "added_by_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "resource_collection_items" DROP COLUMN IF EXISTS "sort_order";--> statement-breakpoint
ALTER TABLE "resource_collection_items" DROP COLUMN IF EXISTS "added_by_profile_user_id";--> statement-breakpoint
ALTER TABLE "resource_collection_profiles" DROP COLUMN IF EXISTS "sort_order";--> statement-breakpoint
ALTER TABLE "resource_collection_profiles" DROP COLUMN IF EXISTS "added_by_profile_user_id";--> statement-breakpoint
ALTER TABLE "resource_collections" DROP COLUMN IF EXISTS "added_by_profile_user_id";--> statement-breakpoint
ALTER TABLE "resources" DROP COLUMN IF EXISTS "added_by_profile_user_id";--> statement-breakpoint
DROP INDEX IF EXISTS "resource_collection_items_order_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "resource_collection_items_order_idx" ON "resource_collection_items" ("collection_id","sort_key") WHERE "deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "resource_collection_items_added_by_idx";--> statement-breakpoint
CREATE INDEX "resource_collection_items_added_by_idx" ON "resource_collection_items" ("added_by_profile_id");--> statement-breakpoint
DROP INDEX IF EXISTS "resource_collection_profiles_order_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "resource_collection_profiles_order_idx" ON "resource_collection_profiles" ("profile_id","sort_key") WHERE "deleted_at" IS NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "resource_collection_profiles_added_by_idx";--> statement-breakpoint
CREATE INDEX "resource_collection_profiles_added_by_idx" ON "resource_collection_profiles" ("added_by_profile_id");--> statement-breakpoint
DROP INDEX IF EXISTS "resource_collections_added_by_idx";--> statement-breakpoint
CREATE INDEX "resource_collections_added_by_idx" ON "resource_collections" ("added_by_profile_id");--> statement-breakpoint
CREATE INDEX "resources_added_by_profile_id_index" ON "resources" ("added_by_profile_id");--> statement-breakpoint
ALTER TABLE "resource_collection_items" ADD CONSTRAINT "resource_collection_items_added_by_profile_id_profiles_id_fkey" FOREIGN KEY ("added_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "resource_collection_profiles" ADD CONSTRAINT "resource_collection_profiles_uj304mviyrZU_fkey" FOREIGN KEY ("added_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "resource_collections" ADD CONSTRAINT "resource_collections_added_by_profile_id_profiles_id_fkey" FOREIGN KEY ("added_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "resources" ADD CONSTRAINT "resources_added_by_profile_id_profiles_id_fkey" FOREIGN KEY ("added_by_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "resources" DROP CONSTRAINT IF EXISTS "resources_attachment_id_attachments_id_fkey", ADD CONSTRAINT "resources_attachment_id_attachments_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachments"("id") ON DELETE RESTRICT;