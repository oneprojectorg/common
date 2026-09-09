-- Seed rows for the platform-admin grant (ADR 0005). Data only, no DDL.
--
-- `seed-access-control.ts` writes the same three sets of rows, but only
-- `docker-compose.dev.yml` runs that script, so this migration is how they
-- reach staging and production. Every statement is idempotent.
--
-- The guard exists because no migration has ever inserted a global role, so
-- nothing in this repository proves what any given database holds at the fixed
-- seed ids. A database where '…0014' is some other role would take the role
-- INSERT as a conflict, skip it, and then hand that other role ACRUD on four
-- zones. A collision must abort the deploy, not mis-grant.
DO $$
BEGIN
	IF EXISTS (
		SELECT 1 FROM "access_zones"
		WHERE "id" = '00000000-0000-4000-8000-000000000004'
			AND "name" <> 'platform'
	) THEN
		RAISE EXCEPTION 'access_zones id 00000000-0000-4000-8000-000000000004 already holds the zone %, not platform', (
			SELECT "name" FROM "access_zones"
			WHERE "id" = '00000000-0000-4000-8000-000000000004'
		);
	END IF;

	IF EXISTS (
		SELECT 1 FROM "access_zones"
		WHERE "name" = 'platform'
			AND "id" <> '00000000-0000-4000-8000-000000000004'
	) THEN
		RAISE EXCEPTION 'the platform zone already exists at id %, not 00000000-0000-4000-8000-000000000004', (
			SELECT "id" FROM "access_zones" WHERE "name" = 'platform'
		);
	END IF;

	IF EXISTS (
		SELECT 1 FROM "access_roles"
		WHERE "id" = '00000000-0000-4000-8000-000000000014'
			AND "name" <> 'Platform Admin'
	) THEN
		RAISE EXCEPTION 'access_roles id 00000000-0000-4000-8000-000000000014 already holds the role %, not Platform Admin', (
			SELECT "name" FROM "access_roles"
			WHERE "id" = '00000000-0000-4000-8000-000000000014'
		);
	END IF;

	IF EXISTS (
		SELECT 1 FROM "access_roles"
		WHERE "name" = 'Platform Admin'
			AND "profile_id" IS NULL
			AND "id" <> '00000000-0000-4000-8000-000000000014'
	) THEN
		RAISE EXCEPTION 'the global Platform Admin role already exists at id %, not 00000000-0000-4000-8000-000000000014', (
			SELECT "id" FROM "access_roles"
			WHERE "name" = 'Platform Admin' AND "profile_id" IS NULL
		);
	END IF;
END $$;--> statement-breakpoint

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
-- Role and zones are resolved by name, not by literal id: the names are the
-- runtime identifiers, and a zone absent from a database seeded from scratch
-- (the test DB, wiped before every run) is skipped instead of failing the
-- foreign key. The guard above has already proved the names and ids agree.
INSERT INTO "access_role_permissions_on_access_zones"
	("access_role_id", "access_zone_id", "permission", "profile_id")
SELECT r."id", z."id", 31, NULL
FROM "access_roles" r
JOIN "access_zones" z
	ON z."name" IN ('platform', 'admin', 'profile', 'decisions')
WHERE r."name" = 'Platform Admin'
	AND r."profile_id" IS NULL
ON CONFLICT DO NOTHING;
