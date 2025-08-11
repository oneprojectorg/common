CREATE INDEX "organizationUser_to_access_roles_org_user_idx" ON "organizationUser_to_access_roles" USING btree ("organization_user_id");--> statement-breakpoint
CREATE INDEX "organizationUser_to_access_roles_role_idx" ON "organizationUser_to_access_roles" USING btree ("access_role_id");
