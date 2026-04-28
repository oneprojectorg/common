ALTER TABLE "posts" ADD COLUMN "root_profile_id" uuid;--> statement-breakpoint
ALTER TABLE "posts" ADD COLUMN "root_post_id" uuid;--> statement-breakpoint
CREATE INDEX "posts_root_profile_id_index" ON "posts" ("root_profile_id");--> statement-breakpoint
CREATE INDEX "posts_root_post_id_index" ON "posts" ("root_post_id");--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_root_profile_id_profiles_id_fkey" FOREIGN KEY ("root_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_root_post_id_posts_id_fkey" FOREIGN KEY ("root_post_id") REFERENCES "posts"("id") ON DELETE CASCADE;