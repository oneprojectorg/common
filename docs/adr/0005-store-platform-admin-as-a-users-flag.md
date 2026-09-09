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

In scope: how the platform-wide grant is stored and how it is read. Out of
scope: the org- and profile-scoped authorization model (access-zones role
grants), which is unchanged.

## Decision

We store platform admin as `users.is_platform_admin`, a `NOT NULL DEFAULT
false` boolean on the `users` row — the Django `is_superuser` pattern. It is
keyed by `auth_user_id`, like every other authorization lookup.

The application reads the column and never writes it. There is no procedure, no
service function and no screen that changes it: the flag is granted and revoked
by an operator with database access — direct SQL, the Supabase dashboard, or a
migration.

- Two reads live in `@op/common`, and the split is the point. The API gate,
  `withAuthenticatedPlatformAdmin`, calls `isPlatformAdmin({ authUserId })`,
  which is **read-through**: a single-column indexed lookup per request, no
  cache. An authorization decision must not be able to admit someone on the
  strength of a stale entry that no code path can invalidate, and the admin
  surface is small and rarely hit, so the query is cheap.
- `isPlatformAdminCached` is the same read behind a **5-minute TTL**
  (`PLATFORM_ADMIN_CACHE_TTL_MS`) under a dedicated `platformAdmin` cache type.
  Its only caller is `account.getMyAccount`, which is hot and whose answer only
  decides whether the `/admin` layout renders or 404s. **So the layout may lag
  a change by up to the TTL; the API gate behind it never does.**
- `getMyAccount` spreads that flag over the account row before encoding, rather
  than serving it from the 72h `user` cache entry the rest of the account comes
  from — that entry is stale by three days at worst, and entries written before
  this column existed don't carry it at all. `userEncoder` therefore defaults
  the field instead of requiring it.
- The eight addresses that were in the allowlist are set once, in the migration
  that adds the column, matched against `auth.users.email` — the authoritative
  one, since `public.users.email` is `NULL` for upgraded anonymous accounts.
  That statement is bootstrap, not a source of truth, and is never re-run.
- The Platform Admin users table shows the flag read-only, so an operator can
  see who holds it.

## Consequences

- Changing the grant no longer needs a deploy, but it does need database
  access. That is a deliberate trade: the set of people who can mint a
  superuser is the set of people who already hold infrastructure credentials.
- A revocation stops the API immediately (the gate is read-through) but can
  leave the `/admin` shell rendering for up to five minutes. No code path can
  force that entry out — worth knowing during an incident, where the fast path
  is disabling the account, not clearing the flag.
- The gate costs one small indexed query per admin request. That is only
  acceptable while the admin surface stays small; a hot endpoint behind this
  middleware would need the cached read plus a real invalidation story.
- The grant is now data, so it has to be seeded: `seed.ts` and
  `seed-access-control.ts` set the flag for `adminEmails` so a fresh local
  database can reach `/admin`.
- Tests can no longer fake platform admin by mocking `@op/core`. Test users are
  seeded with the flag at creation time instead (`createUser` /
  `setTestPlatformAdmin` in `@op/test`), keeping the "network domain counts as
  platform admin" rule the old mock encoded.
- The org-level `Admin` access role stays a separate concept: it is scoped to
  one organization and grants nothing platform-wide. Two names, two grants —
  worth saying out loud, because the screen shows both in the same table.

## Alternatives considered

- **An admin-screen toggle.** Deliberately not built. A UI that mints
  superusers widens what a compromised or borrowed admin session is worth: one
  click would turn any account into a platform admin. Requiring a database
  write means requiring infrastructure access, which is a much smaller and
  better-audited set of hands than "whoever is signed in to `/admin`".
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
