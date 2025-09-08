CREATE INDEX "organization_relationships_source_organization_id_target_organization_id_index" ON "organization_relationships" USING btree ("source_organization_id","target_organization_id");
