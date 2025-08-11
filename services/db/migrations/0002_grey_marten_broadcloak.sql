CREATE TABLE "access_role_permissions_on_access_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"access_role_id" uuid NOT NULL,
	"access_zone_id" uuid NOT NULL,
	"permission" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "access_role_permissions_on_access_zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "access_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(500),
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "access_zones_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "access_zones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "access_roles" ALTER COLUMN "name" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "access_roles" ADD COLUMN "description" varchar(500);--> statement-breakpoint
ALTER TABLE "access_role_permissions_on_access_zones" ADD CONSTRAINT "access_role_permissions_on_access_zones_access_role_id_access_roles_id_fk" FOREIGN KEY ("access_role_id") REFERENCES "public"."access_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_role_permissions_on_access_zones" ADD CONSTRAINT "access_role_permissions_on_access_zones_access_zone_id_access_zones_id_fk" FOREIGN KEY ("access_zone_id") REFERENCES "public"."access_zones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX CONCURRENTLY "access_role_permissions_on_access_zones_access_role_id_index" ON "access_role_permissions_on_access_zones" USING btree ("access_role_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "access_role_permissions_on_access_zones_access_zone_id_index" ON "access_role_permissions_on_access_zones" USING btree ("access_zone_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "access_role_permissions_on_access_zones_access_role_id_access_zone_id_index" ON "access_role_permissions_on_access_zones" USING btree ("access_role_id","access_zone_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "access_zones_id_index" ON "access_zones" USING btree ("id");--> statement-breakpoint
ALTER TABLE "access_roles" DROP COLUMN "access";--> statement-breakpoint
ALTER TABLE "access_roles" ADD CONSTRAINT "access_roles_name_unique" UNIQUE("name");--> statement-breakpoint
CREATE POLICY "service-role" ON "access_role_permissions_on_access_zones" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "access_zones" AS PERMISSIVE FOR ALL TO "service_role";