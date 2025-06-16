CREATE TYPE IF NOT EXISTS "public"."link_type" AS ENUM('offering', 'receiving', 'website', 'social');--> statement-breakpoint
CREATE TYPE IF NOT EXISTS "public"."org_type" AS ENUM('nonprofit', 'forprofit', 'government', 'other');--> statement-breakpoint
CREATE TABLE "access_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"access" integer,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "access_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256),
	"href" varchar(256) NOT NULL,
	"link_type" "link_type" DEFAULT 'offering' NOT NULL,
	"metadata" jsonb,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_relationships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_organization_id" uuid NOT NULL,
	"target_organization_id" uuid NOT NULL,
	"relationship_type" varchar(255) NOT NULL,
	"pending" boolean,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "organization_relationships" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizationUser_to_access_roles" (
	"organization_user_id" uuid NOT NULL,
	"access_role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organizationUser_to_access_roles_organization_user_id_access_role_id_pk" PRIMARY KEY("organization_user_id","access_role_id")
);
--> statement-breakpoint
ALTER TABLE "organizationUser_to_access_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organization_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"name" varchar(256),
	"email" varchar NOT NULL,
	"about" text,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "organization_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(256) NOT NULL,
	"description" text,
	"mission" text,
	"year_founded" integer,
	"email" varchar(255),
	"phone" varchar(50),
	"website" varchar(255),
	"address" varchar(255),
	"city" varchar(100),
	"state" varchar(50),
	"postal_code" varchar(20),
	"is_verified" boolean DEFAULT false,
	"is_offering_funds" boolean DEFAULT false,
	"is_receiving_funds" boolean DEFAULT false,
	"org_type" "org_type" DEFAULT 'other' NOT NULL,
	"header_image_id" uuid,
	"avatar_image_id" uuid,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations_strategies" (
	"organization_id" uuid NOT NULL,
	"taxonomy_term_id" uuid NOT NULL,
	CONSTRAINT "organizations_strategies_organization_id_taxonomy_term_id_pk" PRIMARY KEY("organization_id","taxonomy_term_id")
);
--> statement-breakpoint
CREATE TABLE "organizations_where_we_work" (
	"organization_id" uuid NOT NULL,
	"taxonomy_term_id" uuid NOT NULL,
	CONSTRAINT "organizations_where_we_work_organization_id_taxonomy_term_id_pk" PRIMARY KEY("organization_id","taxonomy_term_id")
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "posts_to_organizations" (
	"post_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "posts_to_organizations_organization_id_post_id_pk" PRIMARY KEY("organization_id","post_id")
);
--> statement-breakpoint
ALTER TABLE "posts_to_organizations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(256) NOT NULL,
	"description" varchar(256),
	"organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "projects_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "taxonomies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"namespace_uri" varchar(255),
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "taxonomies_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "taxonomies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "taxonomyTerms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taxonomy_id" uuid,
	"term_uri" varchar(255) NOT NULL,
	"label" varchar(255) NOT NULL,
	"definition" text,
	"parent_id" uuid,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "taxonomyTerms_taxonomy_id_term_uri_unique" UNIQUE("taxonomy_id","term_uri")
);
--> statement-breakpoint
ALTER TABLE "taxonomyTerms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"username" varchar(256),
	"name" varchar(256),
	"email" varchar NOT NULL,
	"about" text,
	"title" varchar(256),
	"avatar_image_id" uuid,
	"last_org_id" uuid,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organization_relationships" ADD CONSTRAINT "organization_relationships_source_organization_id_organizations_id_fk" FOREIGN KEY ("source_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_relationships" ADD CONSTRAINT "organization_relationships_target_organization_id_organizations_id_fk" FOREIGN KEY ("target_organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizationUser_to_access_roles" ADD CONSTRAINT "organizationUser_to_access_roles_organization_user_id_organization_users_id_fk" FOREIGN KEY ("organization_user_id") REFERENCES "public"."organization_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organizationUser_to_access_roles" ADD CONSTRAINT "organizationUser_to_access_roles_access_role_id_access_roles_id_fk" FOREIGN KEY ("access_role_id") REFERENCES "public"."access_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_auth_user_id_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_header_image_id_objects_id_fk" FOREIGN KEY ("header_image_id") REFERENCES "storage"."objects"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_avatar_image_id_objects_id_fk" FOREIGN KEY ("avatar_image_id") REFERENCES "storage"."objects"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organizations_strategies" ADD CONSTRAINT "organizations_strategies_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organizations_strategies" ADD CONSTRAINT "organizations_strategies_taxonomy_term_id_taxonomyTerms_id_fk" FOREIGN KEY ("taxonomy_term_id") REFERENCES "public"."taxonomyTerms"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organizations_where_we_work" ADD CONSTRAINT "organizations_where_we_work_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organizations_where_we_work" ADD CONSTRAINT "organizations_where_we_work_taxonomy_term_id_taxonomyTerms_id_fk" FOREIGN KEY ("taxonomy_term_id") REFERENCES "public"."taxonomyTerms"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "posts_to_organizations" ADD CONSTRAINT "posts_to_organizations_post_id_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts_to_organizations" ADD CONSTRAINT "posts_to_organizations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "taxonomyTerms" ADD CONSTRAINT "taxonomyTerms_taxonomy_id_taxonomies_id_fk" FOREIGN KEY ("taxonomy_id") REFERENCES "public"."taxonomies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomyTerms" ADD CONSTRAINT "taxonomyTerms_parent_id_taxonomyTerms_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."taxonomyTerms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_auth_user_id_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_image_id_objects_id_fk" FOREIGN KEY ("avatar_image_id") REFERENCES "storage"."objects"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_last_org_id_organizations_id_fk" FOREIGN KEY ("last_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_relationships_source_organization_id_target_organization_id_relationship_type_index" ON "organization_relationships" USING btree ("source_organization_id","target_organization_id","relationship_type");--> statement-breakpoint
CREATE VIEW "public"."users_used_storage" WITH (security_invoker = false) AS (select (storage.foldername("name"))[1] as "user_id", COALESCE(SUM(("metadata"->>'size')::bigint), 0) as "total_size" from "storage"."objects" where "storage"."objects"."bucket_id" = 'assets' group by (storage.foldername("storage"."objects"."name"))[1]);--> statement-breakpoint
CREATE POLICY "service-role" ON "access_roles" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "links" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "organization_relationships" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "organizationUser_to_access_roles" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "organization_users" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "organizations" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "posts" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "posts_to_organizations" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "projects" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "taxonomies" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "taxonomyTerms" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "users" AS PERMISSIVE FOR ALL TO "service_role";
