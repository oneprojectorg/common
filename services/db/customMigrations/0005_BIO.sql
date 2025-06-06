CREATE INDEX CONCURRENTLY "links_organization_id_idx" ON "links" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organizationUsers_auth_user_id_idx" ON "organization_users" USING btree ("auth_user_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organizations_header_image_id_idx" ON "organizations" USING btree ("header_image_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organizations_avatar_image_id_idx" ON "organizations" USING btree ("avatar_image_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "projects_organization_id_idx" ON "projects" USING btree ("organization_id");
