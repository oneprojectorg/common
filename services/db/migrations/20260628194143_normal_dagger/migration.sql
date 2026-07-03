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
CREATE INDEX CONCURRENTLY "custom_form_submissions_custom_form_id_index" ON "custom_form_submissions" ("custom_form_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "custom_form_submissions_profile_id_index" ON "custom_form_submissions" ("profile_id");--> statement-breakpoint
CREATE INDEX CONCURRENTLY "custom_forms_profile_id_index" ON "custom_forms" ("profile_id");--> statement-breakpoint
ALTER TABLE "custom_form_submissions" ADD CONSTRAINT "custom_form_submissions_custom_form_id_custom_forms_id_fkey" FOREIGN KEY ("custom_form_id") REFERENCES "custom_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "custom_form_submissions" ADD CONSTRAINT "custom_form_submissions_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "custom_forms" ADD CONSTRAINT "custom_forms_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "custom_form_submissions" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "custom_forms" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint

-- Seed the Columbus idea-submission form. Conditional INSERT so this is a
-- no-op in environments where the Columbus decision profile does not exist
-- (e.g. fresh local stacks, test DBs). When the profile does exist, the form
-- attaches to it via profile_id and is unique per (profile, name) since
-- nothing else creates rows in this table yet.
INSERT INTO public.custom_forms (profile_id, name, schema)
SELECT
  p.id,
  'Idea Submission',
  $JSON${
    "title": "Tell us more about your idea",
    "description": "A few extra questions from the Columbus team. Your answers are stored with your idea.",
    "type": "object",
    "required": ["neighborhood", "agreeToTerms"],
    "properties": {
      "neighborhood": {
        "type": "string",
        "title": "Which neighborhood does this idea help?",
        "x-format": "dropdown",
        "enum": ["Downtown", "Franklinton", "Linden", "Hilltop", "South Side", "Other"]
      },
      "estimatedBudget": {
        "type": "number",
        "title": "Estimated budget (USD)",
        "description": "Optional. Leave blank if unsure."
      },
      "additionalNotes": {
        "type": "string",
        "title": "Anything else we should know?",
        "x-format": "long-text"
      },
      "agreeToTerms": {
        "type": "boolean",
        "title": "I confirm the information above is accurate."
      }
    },
    "x-field-order": ["neighborhood", "estimatedBudget", "additionalNotes", "agreeToTerms"]
  }$JSON$::jsonb
FROM public.profiles p
WHERE p.slug = 'columbus'
  AND p.entity_type = 'decision'
  AND NOT EXISTS (
    SELECT 1 FROM public.custom_forms cf
    WHERE cf.profile_id = p.id
      AND cf.name = 'Idea Submission'
  );