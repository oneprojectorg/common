CREATE TYPE "public"."entity_type" AS ENUM('org', 'user');--> statement-breakpoint
CREATE TABLE "locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"place_id" varchar(512),
	"address" text,
	"plus_code" varchar(128),
	"location" geometry(point),
	"country_code" varchar(2),
	"country_name" varchar(256),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "locations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "locations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" DEFAULT 'org' NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(256) NOT NULL,
	"bio" text,
	"mission" text,
	"email" varchar(255),
	"phone" varchar(50),
	"website" varchar(255),
	"address" varchar(255),
	"city" varchar(100),
	"state" varchar(50),
	"postal_code" varchar(20),
	"header_image_id" uuid,
	"avatar_image_id" uuid,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('simple', "profiles"."name"), 'A') || ' ' || setweight(to_tsvector('english', COALESCE("profiles"."bio", '')), 'B') || ' ' || setweight(to_tsvector('english', COALESCE("profiles"."mission", '')), 'C')::tsvector) STORED,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "profiles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_slug_unique";--> statement-breakpoint
ALTER TABLE "organization_relationships" DROP CONSTRAINT "organization_relationships_source_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "organization_relationships" DROP CONSTRAINT "organization_relationships_target_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_header_image_id_objects_id_fk";
--> statement-breakpoint
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_avatar_image_id_objects_id_fk";
--> statement-breakpoint
ALTER TABLE "organizations_where_we_work" DROP CONSTRAINT "organizations_where_we_work_taxonomy_term_id_taxonomyTerms_id_fk";
--> statement-breakpoint
DROP INDEX "organizations_slug_index";--> statement-breakpoint
DROP INDEX "organizations_search_gin_index";--> statement-breakpoint
ALTER TABLE "organizations_where_we_work" DROP CONSTRAINT "organizations_where_we_work_organization_id_taxonomy_term_id_pk";--> statement-breakpoint
ALTER TABLE "organizations_where_we_work" ADD CONSTRAINT "organizations_where_we_work_organization_id_location_id_pk" PRIMARY KEY("organization_id","location_id");--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "profile_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "organizations_where_we_work" ADD COLUMN "location_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_header_image_id_objects_id_fk" FOREIGN KEY ("header_image_id") REFERENCES "storage"."objects"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatar_image_id_objects_id_fk" FOREIGN KEY ("avatar_image_id") REFERENCES "storage"."objects"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "locations_id_index" ON "locations" USING btree ("id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "locations_place_id_index" ON "locations" USING btree ("place_id");--> statement-breakpoint
CREATE INDEX "spatial_index" ON "locations" USING gist ("location");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "profiles_id_index" ON "profiles" USING btree ("id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "profiles_slug_index" ON "profiles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "profiles_search_gin_index" ON "profiles" USING gin ("search");--> statement-breakpoint
ALTER TABLE "organization_relationships" ADD CONSTRAINT "organization_relationships_source_organization_id_organizations_id_fk" FOREIGN KEY ("source_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_relationships" ADD CONSTRAINT "organization_relationships_target_organization_id_organizations_id_fk" FOREIGN KEY ("target_organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organizations_where_we_work" ADD CONSTRAINT "organizations_where_we_work_location_id_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."locations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organization_relationships_source_organization_id_pending_index" ON "organization_relationships" USING btree ("source_organization_id","pending");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organization_relationships_target_organization_id_pending_index" ON "organization_relationships" USING btree ("target_organization_id","pending");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "organization_relationships_relationship_type_pending_index" ON "organization_relationships" USING btree ("relationship_type","pending");--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "bio";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "mission";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "year_founded";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "email";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "phone";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "website";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "city";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "state";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "postal_code";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "header_image_id";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "avatar_image_id";--> statement-breakpoint
ALTER TABLE "organizations" DROP COLUMN "search";--> statement-breakpoint
ALTER TABLE "organizations_where_we_work" DROP COLUMN "taxonomy_term_id";--> statement-breakpoint
CREATE POLICY "service-role" ON "locations" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "profiles" AS PERMISSIVE FOR ALL TO "service_role";