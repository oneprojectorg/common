--> statement-breakpoint
CREATE INDEX CONCURRENTLY "profiles_id_index" ON "profiles" USING btree ("id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "profiles_email_index" ON "profiles" USING btree ("email");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "profiles_username_index" ON "profiles" USING btree ("username");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "profiles_email_gin_index" ON "profiles" USING gin (to_tsvector('english', "email"));

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "profiles_username_gin_index" ON "profiles" USING gin (to_tsvector('english', "username"));

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "access_roles_id_index" ON "access_roles" USING btree ("id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "links_id_index" ON "links" USING btree ("id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organizations_id_index" ON "organizations" USING btree ("id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organizations_slug_index" ON "organizations" USING btree ("slug");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organizations_name_gin_index" ON "organizations" USING gin (to_tsvector('english', "name"));

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "projects_id_index" ON "projects" USING btree ("id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "projects_slug_index" ON "projects" USING btree ("slug");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "profiles_organizations_idx" ON "profiles" USING btree ("organization_id");