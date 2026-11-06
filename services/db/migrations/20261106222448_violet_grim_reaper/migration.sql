CREATE TABLE "decisions_vote_ballot_proposals" (
	"ballot_id" uuid,
	"proposal_id" uuid,
	"position" integer NOT NULL,
	"rank" integer,
	CONSTRAINT "decisions_vote_ballot_proposals_pkey" PRIMARY KEY("ballot_id","proposal_id")
);
--> statement-breakpoint
ALTER TABLE "decisions_vote_ballot_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "decisions_vote_ballots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"receipt_hash" text NOT NULL,
	"ballot_data" jsonb NOT NULL,
	"cast_on" date DEFAULT CURRENT_DATE NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decisions_vote_ballots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "decisions_vote_ballot_proposals_proposal_id_index" ON "decisions_vote_ballot_proposals" ("proposal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_vote_ballot_proposals_ballot_id_rank_index" ON "decisions_vote_ballot_proposals" ("ballot_id","rank") WHERE rank IS NOT NULL;--> statement-breakpoint
CREATE INDEX "decisions_vote_ballots_process_instance_id_index" ON "decisions_vote_ballots" ("process_instance_id");--> statement-breakpoint
CREATE UNIQUE INDEX "decisions_vote_ballots_receipt_hash_index" ON "decisions_vote_ballots" ("receipt_hash");--> statement-breakpoint
ALTER TABLE "decisions_vote_ballot_proposals" ADD CONSTRAINT "decisions_vote_ballot_proposals_oZpPffIkSgGd_fkey" FOREIGN KEY ("ballot_id") REFERENCES "decisions_vote_ballots"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decisions_vote_ballot_proposals" ADD CONSTRAINT "decisions_vote_ballot_proposals_nuY7HbJDImc1_fkey" FOREIGN KEY ("proposal_id") REFERENCES "decision_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decisions_vote_ballots" ADD CONSTRAINT "decisions_vote_ballots_v3EW1j9M9ca4_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decisions_vote_ballot_proposals" AS PERMISSIVE FOR ALL TO "service_role";--> statement-breakpoint
CREATE POLICY "service-role" ON "decisions_vote_ballots" AS PERMISSIVE FOR ALL TO "service_role";