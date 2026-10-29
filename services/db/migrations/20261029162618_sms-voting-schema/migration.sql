CREATE TABLE "decision_chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"phone_number_id" uuid,
	"page_cursor" integer,
	"reopened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_chat_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_phone_numbers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"phone_number" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "decision_phone_numbers_phone_number_e164_chk" CHECK ("phone_number" ~ '^\+[1-9][0-9]{1,14}$')
);
--> statement-breakpoint
ALTER TABLE "decision_phone_numbers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decision_voter_enrolments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"taxonomy_term_id" uuid,
	"enrolled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decision_voter_enrolments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decisions_vote_draft_proposals" (
	"vote_draft_id" uuid,
	"proposal_id" uuid,
	"rank" integer,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone,
	CONSTRAINT "decisions_vote_draft_proposals_pkey" PRIMARY KEY("vote_draft_id","proposal_id")
);
--> statement-breakpoint
ALTER TABLE "decisions_vote_draft_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decisions_vote_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "decisions_vote_drafts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decision_process_instances" ADD COLUMN "next_short_code" integer DEFAULT 101 NOT NULL;--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD COLUMN "short_code" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "decision_chat_sessions_instance_profile_uniq" ON "decision_chat_sessions" ("process_instance_id","profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decision_phone_numbers_process_instance_id_uniq" ON "decision_phone_numbers" ("process_instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decision_phone_numbers_phone_number_uniq" ON "decision_phone_numbers" ("phone_number");--> statement-breakpoint
CREATE UNIQUE INDEX "decision_voter_enrolments_instance_profile_uniq" ON "decision_voter_enrolments" ("process_instance_id","profile_id");--> statement-breakpoint
CREATE INDEX "decisions_vote_draft_proposals_vote_draft_id_index" ON "decisions_vote_draft_proposals" ("vote_draft_id");--> statement-breakpoint
CREATE INDEX "decisions_vote_draft_proposals_proposal_id_index" ON "decisions_vote_draft_proposals" ("proposal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_vote_draft_proposals_vote_draft_id_rank_index" ON "decisions_vote_draft_proposals" ("vote_draft_id","rank") WHERE rank IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_vote_drafts_instance_profile_uniq" ON "decisions_vote_drafts" ("process_instance_id","profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_process_short_code_uniq" ON "decision_proposals" ("process_instance_id","short_code") WHERE "short_code" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "decision_chat_sessions" ADD CONSTRAINT "decision_chat_sessions_Kbpe7lKWNIOx_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_chat_sessions" ADD CONSTRAINT "decision_chat_sessions_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_chat_sessions" ADD CONSTRAINT "decision_chat_sessions_pRlSY8KMsXm7_fkey" FOREIGN KEY ("phone_number_id") REFERENCES "decision_phone_numbers"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_phone_numbers" ADD CONSTRAINT "decision_phone_numbers_WKVwzwXngt7m_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_voter_enrolments" ADD CONSTRAINT "decision_voter_enrolments_PbJbomW5dZtL_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_voter_enrolments" ADD CONSTRAINT "decision_voter_enrolments_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_voter_enrolments" ADD CONSTRAINT "decision_voter_enrolments_ulF7ZHLm8K4r_fkey" FOREIGN KEY ("taxonomy_term_id") REFERENCES "taxonomyTerms"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decisions_vote_draft_proposals" ADD CONSTRAINT "decisions_vote_draft_proposals_K7Sgp5zr8aYL_fkey" FOREIGN KEY ("vote_draft_id") REFERENCES "decisions_vote_drafts"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decisions_vote_draft_proposals" ADD CONSTRAINT "decisions_vote_draft_proposals_zHeniAafVdhG_fkey" FOREIGN KEY ("proposal_id") REFERENCES "decision_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decisions_vote_drafts" ADD CONSTRAINT "decisions_vote_drafts_GRfbnDOwsttl_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decisions_vote_drafts" ADD CONSTRAINT "decisions_vote_drafts_profile_id_profiles_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_chat_sessions" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_phone_numbers" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_voter_enrolments" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decisions_vote_draft_proposals" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decisions_vote_drafts" AS PERMISSIVE FOR ALL TO "service_role";