-- The seeded decision "Admin" role no longer grants REVIEW (bit 6, value 64):
-- running a process is not reviewing for it. Existing grants have to follow, or
-- a default admin keeps the reviewer surfaces on every process created so far.
--
-- Deliberately narrow. Only rows that are still exactly what the seed wrote are
-- touched:
--   * the decisions zone,
--   * a process-scoped role (access_roles.profile_id IS NOT NULL) still named
--     'Admin' — global platform roles are never seeded by
--     createDefaultDecisionRoles,
--   * the role's global permission row (profile_id IS NULL) — a process-scoped
--     role only ever carries that one row (assertPermissionRowScope),
--   * permission = 511, the exact seeded bitfield
--     (DELETE|UPDATE|READ|CREATE|ADMIN = 31, INVITE_MEMBERS 32, REVIEW 64,
--     SUBMIT_PROPOSALS 128, VOTE 256).
--
-- Any role an operator has edited since — renamed, or with a single bit changed
-- either way — no longer equals 511 and keeps whatever it holds, including a
-- deliberate decision to make admins reviewers. Existing review assignments are
-- rows and survive regardless; assertReviewAssignmentContext admits an admin,
-- so nobody mid-review loses the assignment they already hold.
--
-- A raw UPDATE cannot reach the `profileUser` cache the way updateDecisionRoles
-- does (invalidateProfileUserCacheForRole), so an admin with a warm entry keeps
-- `review: true` until it expires — 72h at most. The window is cosmetic: they
-- see today's reviewer tab pair over an empty queue, and gain nothing they did
-- not already have.
UPDATE "access_role_permissions_on_access_zones" AS arpoaz
SET "permission" = 447
FROM "access_roles" AS ar, "access_zones" AS az
WHERE arpoaz."access_role_id" = ar."id"
  AND arpoaz."access_zone_id" = az."id"
  AND az."name" = 'decisions'
  AND ar."name" = 'Admin'
  AND ar."profile_id" IS NOT NULL
  AND arpoaz."profile_id" IS NULL
  AND arpoaz."permission" = 511;