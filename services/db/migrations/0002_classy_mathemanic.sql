CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"storage_object_id" uuid NOT NULL,
	"file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size" bigint,
	"uploaded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations_terms" (
	"organization_id" uuid NOT NULL,
	"taxonomy_term_id" uuid NOT NULL,
	CONSTRAINT "organizations_terms_organization_id_taxonomy_term_id_pk" PRIMARY KEY("organization_id","taxonomy_term_id")
);
--> statement-breakpoint
ALTER TABLE "organizations_terms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations_strategies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations_where_we_work" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "organizations_name_gin_index";--> statement-breakpoint
DROP INDEX "organizations_header_image_id_idx";--> statement-breakpoint
DROP INDEX "organizations_avatar_image_id_idx";--> statement-breakpoint
ALTER TABLE "links" ADD COLUMN "description" varchar(256);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "domain" varchar(255);--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "network_organization" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', "organizations"."name"), 'A') || ' ' || setweight(to_tsvector('english',  "organizations"."bio"), 'B') || ' ' || setweight(to_tsvector('english', "organizations"."mission"), 'C')::tsvector) STORED;--> statement-breakpoint
ALTER TABLE "taxonomyTerms" ADD COLUMN "facet" varchar(255);--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_storage_object_id_objects_id_fk" FOREIGN KEY ("storage_object_id") REFERENCES "storage"."objects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_organization_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."organization_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations_terms" ADD CONSTRAINT "organizations_terms_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organizations_terms" ADD CONSTRAINT "organizations_terms_taxonomy_term_id_taxonomyTerms_id_fk" FOREIGN KEY ("taxonomy_term_id") REFERENCES "public"."taxonomyTerms"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "attachments_id_index" ON "attachments" USING btree ("id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "attachments_post_id_index" ON "attachments" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "attachments_storage_object_id_index" ON "attachments" USING btree ("storage_object_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "attachments_uploaded_by_index" ON "attachments" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "organizations_search_gin_index" ON "organizations" USING gin ("search");--> statement-breakpoint
CREATE POLICY "service-role" ON "organizations_strategies" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "organizations_where_we_work" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "attachments" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "organizations_terms" AS PERMISSIVE FOR ALL TO "service_role";