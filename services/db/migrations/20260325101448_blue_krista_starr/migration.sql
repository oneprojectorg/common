CREATE TABLE "decision_transition_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"process_instance_id" uuid NOT NULL,
	"transition_history_id" uuid NOT NULL,
	"proposal_id" uuid NOT NULL,
	"proposal_history_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'utc'::text),
	CONSTRAINT "decision_transition_proposals_transition_history_id_proposal_id_unique" UNIQUE("transition_history_id","proposal_id")
);
--> statement-breakpoint
ALTER TABLE "decision_transition_proposals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "decision_proposal_history" ADD CONSTRAINT "prop_hist_process_id_history_id_uniq" UNIQUE("process_instance_id","id","history_id");--> statement-breakpoint
ALTER TABLE "decision_proposals" ADD CONSTRAINT "proposals_process_instance_uniq" UNIQUE("process_instance_id","id");--> statement-breakpoint
ALTER TABLE "decision_transition_history" ADD CONSTRAINT "transition_history_process_instance_uniq" UNIQUE("process_instance_id","id");--> statement-breakpoint
CREATE INDEX "decision_transition_proposals_process_instance_id_index" ON "decision_transition_proposals" ("process_instance_id");--> statement-breakpoint
CREATE INDEX "decision_transition_proposals_transition_history_id_index" ON "decision_transition_proposals" ("transition_history_id");--> statement-breakpoint
CREATE INDEX "decision_transition_proposals_proposal_id_index" ON "decision_transition_proposals" ("proposal_id");--> statement-breakpoint
CREATE INDEX "decision_transition_proposals_proposal_history_id_index" ON "decision_transition_proposals" ("proposal_history_id");--> statement-breakpoint
ALTER TABLE "decision_transition_proposals" ADD CONSTRAINT "decision_transition_proposals_DfIHz26xbtO4_fkey" FOREIGN KEY ("process_instance_id") REFERENCES "decision_process_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_transition_proposals" ADD CONSTRAINT "dtp_transition_history_fkey" FOREIGN KEY ("process_instance_id","transition_history_id") REFERENCES "decision_transition_history"("process_instance_id","id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_transition_proposals" ADD CONSTRAINT "dtp_proposal_fkey" FOREIGN KEY ("process_instance_id","proposal_id") REFERENCES "decision_proposals"("process_instance_id","id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_transition_proposals" ADD CONSTRAINT "dtp_proposal_history_fkey" FOREIGN KEY ("process_instance_id","proposal_id","proposal_history_id") REFERENCES "decision_proposal_history"("process_instance_id","id","history_id") ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
CREATE POLICY "service-role" ON "decision_transition_proposals" AS PERMISSIVE FOR ALL TO "service_role";