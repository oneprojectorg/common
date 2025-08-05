-- pg_trgm is used for the search function and text similarity
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS postgis SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS vector SCHEMA extensions;

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "access_roles_id_index" ON "access_roles" USING btree ("id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "links_id_index" ON "links" USING btree ("id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organization_relationships_source_organization_id_index" ON "organization_relationships" USING btree ("source_organization_id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organization_relationships_target_organization_id_index" ON "organization_relationships" USING btree ("target_organization_id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organization_relationships_relationship_type_index" ON "organization_relationships" USING btree ("relationship_type");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organization_users_id_index" ON "organization_users" USING btree ("id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organization_users_email_index" ON "organization_users" USING btree ("email");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organizationUsers_email_gin_index" ON "organization_users" USING gin (to_tsvector('english', "email"));

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organizationUsers_organizations_idx" ON "organization_users" USING btree ("organization_id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organizations_id_index" ON "organizations" USING btree ("id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organizations_slug_index" ON "organizations" USING btree ("slug");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organizations_name_gin_index" ON "organizations" USING gin (to_tsvector('english', "name"));

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "posts_id_index" ON "posts" USING btree ("id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "projects_id_index" ON "projects" USING btree ("id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "projects_slug_index" ON "projects" USING btree ("slug");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "taxonomyTerms_data_gin_index" ON "taxonomyTerms" USING gin (to_tsvector('english', "label"));

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "users_id_index" ON "users" USING btree ("id");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "users_email_index" ON "users" USING btree ("email");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "users_username_index" ON "users" USING btree ("username");

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "users_email_gin_index" ON "users" USING gin (to_tsvector('english', "email"));

--> statement-breakpoint
CREATE INDEX CONCURRENTLY "users_username_gin_index" ON "users" USING gin (to_tsvector('english', "username"));
