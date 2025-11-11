INSERT INTO "public"."access_roles" ("name", "created_at", "updated_at", "deleted_at") 
VALUES ('Admin', '2025-06-26 14:57:15.327102+00', '2025-06-26 14:57:15.327102+00', null)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "public"."access_roles" ("name") 
VALUES ('Member')
ON CONFLICT ("name") DO NOTHING;
