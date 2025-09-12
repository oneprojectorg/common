CREATE INDEX "allowList_organization_id_index" ON "allowList" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "individuals_profile_id_index" ON "individuals" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "individuals_terms_taxonomy_term_id_index" ON "individuals_terms" USING btree ("taxonomy_term_id");--> statement-breakpoint
CREATE INDEX "organizations_strategies_taxonomy_term_id_index" ON "organizations_strategies" USING btree ("taxonomy_term_id");--> statement-breakpoint
CREATE INDEX "organizations_terms_taxonomy_term_id_index" ON "organizations_terms" USING btree ("taxonomy_term_id");--> statement-breakpoint
CREATE INDEX "organizations_where_we_work_location_id_index" ON "organizations_where_we_work" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "posts_to_organizations_post_id_index" ON "posts_to_organizations" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "profiles_header_image_id_index" ON "profiles" USING btree ("header_image_id");--> statement-breakpoint
CREATE INDEX "profiles_avatar_image_id_index" ON "profiles" USING btree ("avatar_image_id");--> statement-breakpoint
CREATE INDEX "decision_transition_history_triggered_by_profile_id_index" ON "decision_transition_history" USING btree ("triggered_by_profile_id");--> statement-breakpoint
CREATE INDEX "taxonomyTerms_parent_id_index" ON "taxonomyTerms" USING btree ("parent_id");