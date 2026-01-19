CREATE INDEX "users_avatar_image_id_index" ON "users" USING btree ("avatar_image_id");--> statement-breakpoint
CREATE INDEX "users_last_org_id_index" ON "users" USING btree ("last_org_id");--> statement-breakpoint
CREATE INDEX "users_current_profile_id_index" ON "users" USING btree ("current_profile_id");