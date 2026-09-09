ALTER TABLE "users" ADD COLUMN "is_platform_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "users_is_platform_admin_index" ON "users" ("is_platform_admin") WHERE "is_platform_admin";--> statement-breakpoint
-- One-time bootstrap: the platform admins that used to live in the
-- `platformAdminEmails` allowlist in `packages/core/src/config.ts`. From here
-- on the flag is granted and revoked from the Platform Admin screen, so this
-- list is deliberately not kept in sync with anything.
UPDATE "users" SET "is_platform_admin" = true WHERE lower("email") IN (
	'iza@oneproject.org',
	'casimiro@oneproject.org',
	'nour@oneproject.org',
	'raphael@oneproject.org',
	'scott@oneproject.org',
	'zaana@oneproject.org',
	'valentino@oneproject.org',
	'ivan@oneproject.org'
);
