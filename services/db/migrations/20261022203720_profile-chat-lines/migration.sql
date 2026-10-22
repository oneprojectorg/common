CREATE TABLE "profile_chat_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"profile_id" uuid NOT NULL,
	"phone_number" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profile_chat_lines" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "profile_chat_lines_profile_id_uniq" ON "profile_chat_lines" ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profile_chat_lines_phone_number_uniq" ON "profile_chat_lines" ("phone_number");--> statement-breakpoint
ALTER TABLE "profile_chat_lines" ADD CONSTRAINT "profile_chat_lines_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "profile_chat_lines" AS PERMISSIVE FOR ALL TO "service_role";