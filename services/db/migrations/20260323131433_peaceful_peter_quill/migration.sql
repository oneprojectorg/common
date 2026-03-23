CREATE TABLE "decision_transition_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"transition_history_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"proposal_history_id" uuid,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	CONSTRAINT "decision_transition_proposals_transition_history_id_proposal_id_unique" UNIQUE("transition_history_id","proposal_id")
);
--> statement-breakpoint
ALTER TABLE "decision_transition_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "decision_transition_proposals_transition_history_id_index" ON "decision_transition_proposals" ("transition_history_id");--> statement-breakpoint
CREATE INDEX "decision_transition_proposals_proposal_id_index" ON "decision_transition_proposals" ("proposal_id");--> statement-breakpoint
CREATE INDEX "decision_transition_proposals_proposal_history_id_index" ON "decision_transition_proposals" ("proposal_history_id");--> statement-breakpoint
ALTER TABLE "decision_transition_proposals" ADD CONSTRAINT "decision_transition_proposals_cQhIehV2hQEj_fkey" FOREIGN KEY ("transition_history_id") REFERENCES "decision_transition_history"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_transition_proposals" ADD CONSTRAINT "decision_transition_proposals_aOIDjvnmiOm6_fkey" FOREIGN KEY ("proposal_id") REFERENCES "decision_proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_transition_proposals" ADD CONSTRAINT "decision_transition_proposals_tzgkzYtWxFMm_fkey" FOREIGN KEY ("proposal_history_id") REFERENCES "decision_proposal_history"("history_id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_transition_proposals" AS PERMISSIVE FOR ALL TO "service_role";