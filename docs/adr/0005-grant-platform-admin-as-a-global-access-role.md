# 0005. Grant platform admin as a global access role

Date: 2026-09-09

## Status

Proposed

## Context

Platform admin — `/admin` and every `withAuthenticatedPlatformAdmin` procedure
— was an allowlist of eight emails in `@op/core`, so every grant was a deploy
across two Vercel projects (PR #2007). We already have zones, roles and bitfield
permissions to express exactly this.

## Decision

- A `platform` access zone and a seeded global `Platform Admin` role with ACRUD
  on `platform`, `admin`, `profile` and `decisions`, and no decision behaviour
  bits.
- A user-level grant is a `profileUser_to_access_roles` row on the holder's OWN
  individual-profile membership — no new table and no new column.
- `getUserGlobalRoles` anchors on `users.profile_id` = `profile_users.profile_id`
  AND `profile_users.auth_user_id` = the caller, and keeps only global roles
  named in `USER_LEVEL_GLOBAL_ROLE_NAMES` — both load-bearing, since the trigger
  grants every user the global `Admin` role on their own profile.
- `isPlatformAdmin` is `checkPermission({ platform: ADMIN })` over them;
  `getMyAccount` returns them as `user.access`.
- The role stays out of `EXPOSABLE_GLOBAL_ROLE_NAMES`, and nothing in the app
  writes it — an operator or the seed inserts the row.

## Consequences

- Granting platform admin needs database access, not a deploy.
- The role widens nothing yet: ORing it into org and profile access is a
  follow-up.
- The seed rows reach an environment only when an operator runs
  `seed-access-control.ts`; until then `getUserGlobalRoles` returns nothing and
  fails closed.
- Widening `USER_LEVEL_GLOBAL_ROLE_NAMES` is a security decision.
- The own-profile anchor lives in one query, covered by an integration test.
