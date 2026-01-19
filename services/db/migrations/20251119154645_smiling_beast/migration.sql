CREATE TABLE "profileUser_to_access_roles" (
	"profile_user_id" uuid NOT NULL,
	"access_role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "profileUser_to_access_roles_profile_user_id_access_role_id_pk" PRIMARY KEY("profile_user_id","access_role_id")
);
--> statement-breakpoint
ALTER TABLE "profileUser_to_access_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profile_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"name" varchar(256),
	"email" varchar NOT NULL,
	"about" text,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profileUser_to_access_roles" ADD CONSTRAINT "profileUser_to_access_roles_profile_user_id_profile_users_id_fk" FOREIGN KEY ("profile_user_id") REFERENCES "public"."profile_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profileUser_to_access_roles" ADD CONSTRAINT "profileUser_to_access_roles_access_role_id_access_roles_id_fk" FOREIGN KEY ("access_role_id") REFERENCES "public"."access_roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_users" ADD CONSTRAINT "profile_users_auth_user_id_users_id_fk" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "profile_users" ADD CONSTRAINT "profile_users_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "profileUser_to_access_roles_profile_user_idx" ON "profileUser_to_access_roles" USING btree ("profile_user_id");--> statement-breakpoint
CREATE INDEX "profileUser_to_access_roles_role_idx" ON "profileUser_to_access_roles" USING btree ("access_role_id");--> statement-breakpoint
CREATE INDEX "profile_users_id_index" ON "profile_users" USING btree ("id");--> statement-breakpoint
CREATE INDEX "profile_users_email_index" ON "profile_users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "profileUsers_email_gin_index" ON "profile_users" USING gin (to_tsvector('english', "email"));--> statement-breakpoint
CREATE INDEX "profileUsers_profile_idx" ON "profile_users" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "profileUsers_auth_user_id_idx" ON "profile_users" USING btree ("auth_user_id");--> statement-breakpoint
CREATE POLICY "service-role" ON "profileUser_to_access_roles" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "profile_users" AS PERMISSIVE FOR ALL TO "service_role";
