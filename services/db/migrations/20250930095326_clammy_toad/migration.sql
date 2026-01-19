CREATE TABLE "decisions_vote_proposals" (
	"vote_submission_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "decisions_vote_proposals_vote_submission_id_proposal_id_pk" PRIMARY KEY("vote_submission_id","proposal_id")
);
--> statement-breakpoint
ALTER TABLE "decisions_vote_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decisions_vote_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"process_instance_id" uuid NOT NULL,
	"submitted_by_profile_id" uuid NOT NULL,
	"vote_data" jsonb NOT NULL,
	"custom_data" jsonb,
	"signature" text,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "decisions_vote_submissions_process_instance_id_submitted_by_profile_id_unique" UNIQUE("process_instance_id","submitted_by_profile_id")
);
--> statement-breakpoint
ALTER TABLE "decisions_vote_submissions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX IF EXISTS "organization_relationships_source_organization_id_target_organization_id_relationship_type_index";--> statement-breakpoint
ALTER TABLE "decisions_vote_proposals" ADD CONSTRAINT "decisions_vote_proposals_vote_submission_id_decisions_vote_submissions_id_fk" FOREIGN KEY ("vote_submission_id") REFERENCES "public"."decisions_vote_submissions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decisions_vote_proposals" ADD CONSTRAINT "decisions_vote_proposals_proposal_id_decision_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."decision_proposals"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decisions_vote_submissions" ADD CONSTRAINT "decisions_vote_submissions_process_instance_id_decision_process_instances_id_fk" FOREIGN KEY ("process_instance_id") REFERENCES "public"."decision_process_instances"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "decisions_vote_submissions" ADD CONSTRAINT "decisions_vote_submissions_submitted_by_profile_id_profiles_id_fk" FOREIGN KEY ("submitted_by_profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "decisions_vote_proposals_vote_submission_id_index" ON "decisions_vote_proposals" USING btree ("vote_submission_id");--> statement-breakpoint
CREATE INDEX "decisions_vote_proposals_proposal_id_index" ON "decisions_vote_proposals" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "decisions_vote_submissions_id_index" ON "decisions_vote_submissions" USING btree ("id");--> statement-breakpoint
CREATE INDEX "decisions_vote_submissions_process_instance_id_index" ON "decisions_vote_submissions" USING btree ("process_instance_id");--> statement-breakpoint
CREATE INDEX "decisions_vote_submissions_submitted_by_profile_id_index" ON "decisions_vote_submissions" USING btree ("submitted_by_profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "org_rel_source_target_type_unique" ON "organization_relationships" USING btree ("source_organization_id","target_organization_id","relationship_type");--> statement-breakpoint
CREATE POLICY "service-role" ON "decisions_vote_proposals" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decisions_vote_submissions" AS PERMISSIVE FOR ALL TO "service_role";
