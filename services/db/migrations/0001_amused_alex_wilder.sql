CREATE TYPE "public"."link_type" AS ENUM('offering', 'receiving');--> statement-breakpoint
CREATE TYPE "public"."org_type" AS ENUM('cooperative', 'mutual_aid', 'community_org', 'social_enterprise', 'collective', 'commons', 'credit_union', 'land_trust', 'other');--> statement-breakpoint
CREATE TABLE "access_roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"access" integer
);
--> statement-breakpoint
ALTER TABLE "access_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256),
	"href" varchar(256) NOT NULL,
	"link_type" "link_type" DEFAULT 'offering' NOT NULL,
	"organization_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(256) NOT NULL,
	"slug" varchar(256) NOT NULL,
	"description" varchar(256),
	"mission" text,
	"year_founded" integer,
	"values" text[],
	"email" varchar(255),
	"phone" varchar(50),
	"website" varchar(255),
	"address" varchar(255),
	"city" varchar(100),
	"state" varchar(50),
	"postal_code" varchar(20),
	"latitude" numeric,
	"longitude" numeric,
	"is_verified" boolean DEFAULT false,
	"social_links" json,
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
CREATE TABLE "profiles_to_access_roles" (
	"profile_id" uuid NOT NULL,
	"access_role_id" uuid NOT NULL,
	CONSTRAINT "profiles_to_access_roles_profile_id_access_role_id_pk" PRIMARY KEY("profile_id","access_role_id")
);
--> statement-breakpoint
ALTER TABLE "profiles_to_access_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
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
ALTER TABLE "profiles" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "links" ADD CONSTRAINT "links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_header_image_id_objects_id_fk" FOREIGN KEY ("header_image_id") REFERENCES "storage"."objects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_avatar_image_id_objects_id_fk" FOREIGN KEY ("avatar_image_id") REFERENCES "storage"."objects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profiles_to_access_roles" ADD CONSTRAINT "profiles_to_access_roles_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles_to_access_roles" ADD CONSTRAINT "profiles_to_access_roles_access_role_id_access_roles_id_fk" FOREIGN KEY ("access_role_id") REFERENCES "public"."access_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE POLICY "service-role" ON "access_roles" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "links" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "organizations" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "profiles_to_access_roles" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "projects" AS PERMISSIVE FOR ALL TO "service_role";