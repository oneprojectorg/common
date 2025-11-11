-- Insert access zones first
INSERT INTO "public"."access_zones" ("name", "description", "created_at", "updated_at", "deleted_at") 
VALUES 
  ('admin', 'Administrative access zone for managing organization settings, users, and permissions', '2025-06-26 14:57:15.327102+00', '2025-06-26 14:57:15.327102+00', null),
  ('content', 'Content management access zone for posts and other content', '2025-06-26 14:57:15.327102+00', '2025-06-26 14:57:15.327102+00', null),
  ('member', 'Member access zone for viewing organization information', '2025-06-26 14:57:15.327102+00', '2025-06-26 14:57:15.327102+00', null)
ON CONFLICT ("name") DO NOTHING;

-- Insert access roles
INSERT INTO "public"."access_roles" ("name", "description", "created_at", "updated_at", "deleted_at") 
VALUES 
  ('Admin', 'Administrator with full permissions', '2025-06-26 14:57:15.327102+00', '2025-06-26 14:57:15.327102+00', null),
  ('Member', 'Basic member with limited permissions', '2025-06-26 14:57:15.327102+00', '2025-06-26 14:57:15.327102+00', null),
  ('Editor', 'Editor with content management permissions', '2025-06-26 14:57:15.327102+00', '2025-06-26 14:57:15.327102+00', null)
ON CONFLICT ("name") DO NOTHING;

-- Assign permissions to Admin role (READ, WRITE, DELETE = 1 + 2 + 4 = 7)
-- Admin gets full permissions (7) on all zones
INSERT INTO "public"."access_role_permissions_on_access_zones" ("access_role_id", "access_zone_id", "permission", "created_at", "updated_at", "deleted_at")
SELECT 
  ar.id,
  az.id,
  7,
  '2025-06-26 14:57:15.327102+00',
  '2025-06-26 14:57:15.327102+00',
  null
FROM "public"."access_roles" ar
CROSS JOIN "public"."access_zones" az
WHERE ar.name = 'Admin'
ON CONFLICT ("access_role_id", "access_zone_id") DO UPDATE SET "permission" = 7;

-- Assign permissions to Member role (READ = 1)
-- Members get read permissions on member zone only
INSERT INTO "public"."access_role_permissions_on_access_zones" ("access_role_id", "access_zone_id", "permission", "created_at", "updated_at", "deleted_at")
SELECT 
  ar.id,
  az.id,
  1,
  '2025-06-26 14:57:15.327102+00',
  '2025-06-26 14:57:15.327102+00',
  null
FROM "public"."access_roles" ar
CROSS JOIN "public"."access_zones" az
WHERE ar.name = 'Member' AND az.name = 'member'
ON CONFLICT ("access_role_id", "access_zone_id") DO UPDATE SET "permission" = 1;

-- Assign permissions to Editor role (READ, WRITE = 1 + 2 = 3)
-- Editors get read/write on content zone and read on member zone
INSERT INTO "public"."access_role_permissions_on_access_zones" ("access_role_id", "access_zone_id", "permission", "created_at", "updated_at", "deleted_at")
SELECT 
  ar.id,
  az.id,
  CASE 
    WHEN az.name = 'content' THEN 3
    WHEN az.name = 'member' THEN 1
    ELSE 0
  END,
  '2025-06-26 14:57:15.327102+00',
  '2025-06-26 14:57:15.327102+00',
  null
FROM "public"."access_roles" ar
CROSS JOIN "public"."access_zones" az
WHERE ar.name = 'Editor' AND az.name IN ('content', 'member')
ON CONFLICT ("access_role_id", "access_zone_id") DO UPDATE SET "permission" = EXCLUDED.permission;
