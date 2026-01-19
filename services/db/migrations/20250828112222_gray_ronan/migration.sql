DROP INDEX "users_username_index";--> statement-breakpoint
CREATE INDEX "organizations_profile_id_index" ON "organizations" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "organizations_created_at_index" ON "organizations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "organizations_updated_at_index" ON "organizations" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "posts_profile_id_index" ON "posts" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "profiles_updated_at_index" ON "profiles" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "users_auth_user_id_index" ON "users" USING btree ("auth_user_id");
