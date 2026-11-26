ALTER TABLE "decision_transition_proposals" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "decision_transition_history" ADD COLUMN "selection_confirmed_at" timestamp with time zone;