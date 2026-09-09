-- Seed rows for the platform-admin grant (ADR 0005). Data only, no DDL.
--
-- `seed-access-control.ts` writes the same three sets of rows, but only
-- `docker-compose.dev.yml` runs that script, so this migration is how they
-- reach staging and production. The UUIDs are the fixed ids in
-- `seedData/accessControl.ts`; every statement is idempotent.

INSERT INTO "access_zones" ("id", "name", "description")
VALUES (
	'00000000-0000-4000-8000-000000000004',
	'platform',
	'Platform-wide administration, not scoped to any profile'
)
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "access_roles" ("id", "name", "description", "profile_id")
VALUES (
	'00000000-0000-4000-8000-000000000014',
	'Platform Admin',
	'Platform-wide administrator',
	NULL
)
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- permission 31 = ADMIN(16) | CREATE(8) | READ(4) | UPDATE(2) | DELETE(1) —
-- the bitfield `ADMIN_ROLE_PERMISSIONS` computes in `seedData/accessControl.ts`.
-- Deliberately no decision behavior bits: those mark a reviewer or voter.
-- `profile_id` NULL makes each row the role's global baseline.
--
-- Selected from `access_zones` rather than listed as literals: the four zone
-- ids are themselves seed rows, and a database seeded from scratch (the test
-- DB, wiped before every run) has none of them yet, which would fail the
-- foreign key. Production has all four.
INSERT INTO "access_role_permissions_on_access_zones"
	("access_role_id", "access_zone_id", "permission", "profile_id")
SELECT
	'00000000-0000-4000-8000-000000000014',
	"access_zones"."id",
	31,
	NULL
FROM "access_zones"
WHERE "access_zones"."id" IN (
	'00000000-0000-4000-8000-000000000004',
	'00000000-0000-4000-8000-000000000002',
	'00000000-0000-4000-8000-000000000001',
	'00000000-0000-4000-8000-000000000003'
)
ON CONFLICT DO NOTHING;
