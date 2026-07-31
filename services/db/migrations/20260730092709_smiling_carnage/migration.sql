CREATE TABLE "decision_category_reviewers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"taxonomy_term_id" uuid NOT NULL,
	"reviewer_profile_id" uuid NOT NULL,
	"phase_id" varchar(256),
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_category_reviewers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "category_reviewers_unique" ON "decision_category_reviewers" ("process_instance_id","taxonomy_term_id","reviewer_profile_id",COALESCE("phase_id", ''));--> statement-breakpoint
CREATE INDEX "category_reviewers_process_reviewer_idx" ON "decision_category_reviewers" ("process_instance_id","reviewer_profile_id");--> statement-breakpoint
ALTER TABLE "decision_category_reviewers" ADD CONSTRAINT "decision_category_reviewers_QydqFzLvQYhK_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_category_reviewers" ADD CONSTRAINT "decision_category_reviewers_FEvueaKT3S0C_fkey" FOREIGN KEY ("taxonomy_term_id") REFERENCES "taxonomyTerms"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_category_reviewers" ADD CONSTRAINT "decision_category_reviewers_Wj7hp4lzXEyv_fkey" FOREIGN KEY ("reviewer_profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_category_reviewers" AS PERMISSIVE FOR ALL TO "service_role";