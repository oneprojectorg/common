CREATE INDEX "proposalCategories_taxonomyTermId_index" ON "decision_categories" USING btree ("taxonomy_term_id");--> statement-breakpoint
CREATE INDEX "proposalCategories_proposalId_index" ON "decision_categories" USING btree ("proposal_id");--> statement-breakpoint
CREATE INDEX "proposals_status_created_at_idx" ON "decision_proposals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "proposals_process_status_idx" ON "decision_proposals" USING btree ("process_instance_id","status");--> statement-breakpoint
CREATE INDEX "taxonomyTerms_label_btree_index" ON "taxonomyTerms" USING btree ("label");--> statement-breakpoint
CREATE INDEX "taxonomyTerms_taxonomy_label_index" ON "taxonomyTerms" USING btree ("taxonomy_id","label");
