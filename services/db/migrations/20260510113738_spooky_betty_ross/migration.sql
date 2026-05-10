DROP INDEX "process_results_instance_date_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "process_results_instance_unique_idx" ON "decision_process_results" ("process_instance_id");