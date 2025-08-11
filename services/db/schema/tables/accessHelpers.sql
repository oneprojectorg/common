-- Helper SQL snippets for managing access zones and roles
-- These match the access-zones library patterns

-- Create default access zones
INSERT INTO access_zones (id, name, description, created_at, updated_at) VALUES
  (gen_random_uuid(), 'profiles', 'User profiles and profile management', NOW(), NOW()),
  (gen_random_uuid(), 'content', 'Content creation and management', NOW(), NOW()),
  (gen_random_uuid(), 'users', 'User administration', NOW(), NOW()),
  (gen_random_uuid(), 'admin', 'System administration', NOW(), NOW()),
  (gen_random_uuid(), 'settings', 'Application settings', NOW(), NOW()),
  (gen_random_uuid(), 'reports', 'Reports and analytics', NOW(), NOW()),
  (gen_random_uuid(), 'billing', 'Billing and payments', NOW(), NOW()),
  (gen_random_uuid(), 'support', 'Support and help desk', NOW(), NOW()),
  (gen_random_uuid(), 'api', 'API access and management', NOW(), NOW()),
  (gen_random_uuid(), 'files', 'File and media management', NOW(), NOW()),
  (gen_random_uuid(), 'notifications', 'Notification management', NOW(), NOW());

-- Create example roles
INSERT INTO access_roles (id, name, description, created_at, updated_at) VALUES
  ('role-admin', 'Admin', 'Full system access', NOW(), NOW()),
  ('role-editor', 'Editor', 'Content and profile editing', NOW(), NOW()),
  ('role-viewer', 'Viewer', 'Read-only access', NOW(), NOW());

-- Assign permissions to roles (using bitfield values)
-- Permission masks: CREATE=8, READ=4, UPDATE=2, DELETE=1, ADMIN=15 (all)

-- Admin role - full access to all zones
INSERT INTO access_role_permissions_on_access_zones (id, access_role_id, access_zone_id, permission, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'role-admin',
  az.id,
  15, -- ADMIN (all permissions)
  NOW(),
  NOW()
FROM access_zones az;

-- Editor role - can edit content and profiles
INSERT INTO access_role_permissions_on_access_zones (id, access_role_id, access_zone_id, permission, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'role-editor',
  az.id,
  CASE 
    WHEN az.name IN ('content', 'profiles') THEN 14  -- CREATE + READ + UPDATE
    WHEN az.name IN ('files', 'notifications') THEN 6 -- READ + UPDATE
    ELSE 4 -- READ only
  END,
  NOW(),
  NOW()
FROM access_zones az;

-- Viewer role - read-only access
INSERT INTO access_role_permissions_on_access_zones (id, access_role_id, access_zone_id, permission, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  'role-viewer',
  az.id,
  4, -- READ only
  NOW(),
  NOW()
FROM access_zones az;

-- Query to get user's normalized roles (for use with access-zones library)
SELECT 
  ar.id,
  ar.name,
  json_object_agg(az.name, arpaz.permission) as access
FROM organization_user_to_access_roles outar
JOIN access_roles ar ON ar.id = outar.access_role_id
JOIN access_role_permissions_on_access_zones arpaz ON arpaz.access_role_id = ar.id
JOIN access_zones az ON az.id = arpaz.access_zone_id
WHERE outar.organization_user_id = $1
GROUP BY ar.id, ar.name;