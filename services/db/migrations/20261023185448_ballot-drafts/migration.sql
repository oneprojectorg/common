CREATE TABLE "decision_ballot_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"picks" jsonb DEFAULT '[]' NOT NULL,
	"page_cursor" integer,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "decision_ballot_drafts_picks_chk" CHECK (jsonb_typeof("picks") = 'array')
);
--> statement-breakpoint
ALTER TABLE "decision_ballot_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE UNIQUE INDEX "decision_ballot_drafts_instance_profile_uniq" ON "decision_ballot_drafts" ("process_instance_id","profile_id");--> statement-breakpoint
ALTER TABLE "decision_ballot_drafts" ADD CONSTRAINT "decision_ballot_drafts_DohgPPkTPqrK_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_ballot_drafts" ADD CONSTRAINT "decision_ballot_drafts_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_ballot_drafts" AS PERMISSIVE FOR ALL TO "service_role";