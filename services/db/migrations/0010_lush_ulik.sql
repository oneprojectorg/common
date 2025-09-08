CREATE INDEX "org_rel_src_org_id_target_org_id_index" ON "organization_relationships" USING btree ("source_organization_id","target_organization_id");
