CREATE TABLE "profile_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar(256) NOT NULL,
	"profile_id" uuid NOT NULL,
	"profile_entity_type" "entity_type" NOT NULL,
	"access_role_id" uuid NOT NULL,
	"invited_by" uuid NOT NULL,
	"message" text,
	"accepted_on" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "profile_invites_email_idx" ON "profile_invites" ("email");--> statement-breakpoint
CREATE INDEX "profile_invites_profile_idx" ON "profile_invites" ("profile_id");--> statement-breakpoint
CREATE INDEX "profile_invites_entity_type_idx" ON "profile_invites" ("profile_entity_type");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_invites_email_profile_pending_idx" ON "profile_invites" ("email","profile_id") WHERE accepted_on IS NULL;--> statement-breakpoint
ALTER TABLE "profile_invites" ADD CONSTRAINT "profile_invites_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile_invites" ADD CONSTRAINT "profile_invites_access_role_id_access_roles_id_fkey" FOREIGN KEY ("access_role_id") REFERENCES "access_roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "profile_invites" ADD CONSTRAINT "profile_invites_invited_by_profiles_id_fkey" FOREIGN KEY ("invited_by") REFERENCES "profiles"("id") ON DELETE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "profile_invites" AS PERMISSIVE FOR ALL TO "service_role";