ALTER TABLE "decision_process_result_selections" ADD COLUMN "allocated" numeric;--> statement-breakpoint
ALTER TABLE "decision_process_results" ADD COLUMN "voter_count" integer DEFAULT 0 NOT NULL;