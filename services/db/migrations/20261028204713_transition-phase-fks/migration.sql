ALTER TABLE "decision_process_transitions" ADD COLUMN "from_phase_id" uuid;--> statement-breakpoint
ALTER TABLE "decision_process_transitions" ADD COLUMN "to_phase_id" uuid;--> statement-breakpoint
CREATE INDEX "idx_transitions_from_phase" ON "decision_process_transitions" ("from_phase_id");--> statement-breakpoint
CREATE INDEX "idx_transitions_to_phase" ON "decision_process_transitions" ("to_phase_id");--> statement-breakpoint
ALTER TABLE "decision_process_transitions" ADD CONSTRAINT "decision_process_transitions_lrEKuvf49G8c_fkey" FOREIGN KEY ("from_phase_id") REFERENCES "decision_process_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE "decision_process_transitions" ADD CONSTRAINT "decision_process_transitions_fukpw9x6mimr_fkey" FOREIGN KEY ("to_phase_id") REFERENCES "decision_process_phases"("id") ON DELETE SET NULL ON UPDATE CASCADE;