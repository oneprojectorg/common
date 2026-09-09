# 0005. Store platform admin as a flag on the users row

Date: 2026-09-09

## Status

Accepted

## Context

Platform admin — access to `/admin` and to every
`withAuthenticatedPlatformAdmin` tRPC procedure — was a hardcoded set of eight
email addresses in `packages/core/src/config.ts`, read through
`isUserEmailPlatformAdmin(email)`. Every grant and every revocation was a code
change, a review, and a deploy across two Vercel projects (PR #2007); the
allowlist itself carried a note saying it would move to the database. Email is
also the wrong key: it is mutable, it is `NULL` on `public.users` for users who
upgraded from an anonymous session, and matching on it means the authorization
answer depends on which of the two email columns you happen to read.

In scope: how the platform-wide grant is stored, who can change it, and how a
change propagates. Out of scope: the org- and profile-scoped authorization
model (access-zones role grants), which is unchanged.

## Decision

We store platform admin as `users.is_platform_admin`, a `NOT NULL DEFAULT
false` boolean on the `users` row — the Django `is_superuser` pattern. It is
keyed by `auth_user_id`, like every other authorization lookup.

- `isPlatformAdmin({ authUserId })` in `@op/common` is the only read. It
  selects just that column and caches the answer under a dedicated
  `platformAdmin` cache type; `invalidatePlatformAdminCache` drops it together
  with the `user` entry `account.getMyAccount` serves.
- `setPlatformAdmin({ targetAuthUserId, isPlatformAdmin, actorAuthUserId })` is
  the only write. Existing platform admins call it from the Platform Admin
  screen (`platform.admin.setPlatformAdmin`); there is no other path.
- Two guards: an actor cannot change their own flag, and the last remaining
  platform admin cannot be revoked. Together they make it impossible to empty
  the grant out or to lock yourself out by mis-clicking your own row.
- The eight addresses that were in the allowlist are set once, in the migration
  that adds the column. That statement is bootstrap, not a source of truth, and
  is never re-run.

## Consequences

- Granting platform admin is a click by someone who already has it, not a
  deploy. Revocation takes effect on the next request rather than the next
  release.
- The grant is now data, so it has to be seeded: `seed.ts` and
  `seed-access-control.ts` set the flag for `adminEmails` so a fresh local
  database can reach `/admin`.
- The check is a database read rather than a set lookup, so it is cached, and
  every write has to invalidate two cache types. A missed invalidation leaves a
  revoked admin inside `/admin` for up to the 72h TTL — which is why there is
  one invalidation helper and not a call site per mutation.
- Tests can no longer fake platform admin by mocking `@op/core`. Test users are
  seeded with the flag at creation time instead (`createUser` /
  `setTestPlatformAdmin` in `@op/test`), keeping the "network domain counts as
  platform admin" rule the old mock encoded.
- The org-level `Admin` access role stays a separate concept: it is scoped to
  one organization and grants nothing platform-wide. Two names, two grants —
  worth saying out loud, because the screen shows both in the same table.
- Nothing audits who granted what. `setPlatformAdmin` logs actor and target
  through `@op/logging`, which is a log line, not a record.

## Alternatives considered

- **A `platform_admins` table.** A join table would buy a grant timestamp and a
  granting actor. Rejected for now: one row per admin against a table whose
  only column would be the FK, for an audit trail we are not yet reading. It
  remains the migration path if we want history.
- **A user-level role grant in access-zones.** Our zones are scoped to an
  organization or a profile; a platform-wide grant has neither, so it would
  need a new "global" scope that every existing permission check would have to
  learn to ignore. The cost lands on the code that does *not* care about
  platform admin.
- **A Supabase `app_metadata` claim.** It would ride along in the JWT and cost
  no query, but it lives outside our database — invisible to `db.query`,
  unjoinable in the admin list, and only revocable on the next token refresh.
