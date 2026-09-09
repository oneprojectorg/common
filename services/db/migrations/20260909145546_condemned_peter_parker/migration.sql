ALTER TABLE "users" ADD COLUMN "is_platform_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- One-time bootstrap: the platform admins that used to live in the
-- `platformAdminEmails` allowlist in `packages/core/src/config.ts`. The
-- application never writes this column, so every later change is an operator's
-- SQL statement — this list is not a source of truth and is never re-run.
--
-- Matched against auth.users.email, which is authoritative: public.users.email
-- is NULL for accounts that upgraded from an anonymous session and can lag an
-- email change.
UPDATE "users" AS u
SET "is_platform_admin" = true
FROM auth.users AS au
WHERE u."auth_user_id" = au."id"
	AND lower(au."email") IN (
		'iza@oneproject.org',
		'casimiro@oneproject.org',
		'nour@oneproject.org',
		'raphael@oneproject.org',
		'scott@oneproject.org',
		'zaana@oneproject.org',
		'valentino@oneproject.org',
		'ivan@oneproject.org'
	);
