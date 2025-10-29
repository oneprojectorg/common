DROP INDEX "decision_process_results_id_index";--> statement-breakpoint
CREATE INDEX "result_selections_pagination_idx" ON "decision_process_result_selections" USING btree ("process_result_id","selection_rank","proposal_id");--> statement-breakpoint
CREATE INDEX "vote_submissions_instance_id_idx" ON "decisions_vote_submissions" USING btree ("process_instance_id","id");
