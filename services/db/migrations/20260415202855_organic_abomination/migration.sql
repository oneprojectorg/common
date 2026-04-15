CREATE INDEX "profile_rel_source_type_idx" ON "profile_relationships" ("source_profile_id","relationship_type");--> statement-breakpoint
CREATE INDEX "profile_rel_target_type_idx" ON "profile_relationships" ("target_profile_id","relationship_type");
