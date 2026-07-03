CREATE TABLE "custom_form_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"custom_form_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "custom_form_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "custom_forms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"profile_id" uuid NOT NULL,
	"name" varchar(256) NOT NULL,
	"schema" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "custom_forms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "custom_form_submissions_custom_form_id_index" ON "custom_form_submissions" ("custom_form_id");--> statement-breakpoint
CREATE INDEX "custom_form_submissions_profile_id_index" ON "custom_form_submissions" ("profile_id");--> statement-breakpoint
CREATE INDEX "custom_forms_profile_id_index" ON "custom_forms" ("profile_id");--> statement-breakpoint
ALTER TABLE "custom_form_submissions" ADD CONSTRAINT "custom_form_submissions_custom_form_id_custom_forms_id_fkey" FOREIGN KEY ("custom_form_id") REFERENCES "custom_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "custom_form_submissions" ADD CONSTRAINT "custom_form_submissions_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "custom_form_submissions" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "custom_forms" AS PERMISSIVE FOR ALL TO "service_role";