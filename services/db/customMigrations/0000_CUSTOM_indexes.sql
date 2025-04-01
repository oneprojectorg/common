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