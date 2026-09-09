# 0005. Grant platform admin as a global access role

Date: 2026-09-09

## Status

Proposed

## Context

Platform admin — `/admin` plus every `withAuthenticatedPlatformAdmin`
procedure — was a hardcoded set of eight emails in `@op/core`, so every grant
was a code change and a deploy across two Vercel projects (PR #2007). We
already have an authorization model: zones, roles, and bitfield permissions.

What that model lacked was a place to hold a role at the *user* level rather
than per membership. It turns out it already has one. The signup trigger gives
every user an individual profile (`users.profileId`) and an owner membership row
on it (`profile_users`), so the row that represents "this user, as themselves"
exists for everyone.

## Decision

- A `platform` access zone and a seeded global `Platform Admin` role with
  `ADMIN | CREATE | READ | UPDATE | DELETE` on `platform`, `admin`, `profile`
  and `decisions`. No decision behavior bits — those mark a reviewer or voter.
- **A user-level grant is a `profileUser_to_access_roles` row on the holder's
  own individual-profile membership.** No new table and no new column.
- `getUserGlobalRoles({ user })` resolves it, anchored on `users.profileId` =
  `profile_users.profile_id` **and** `profile_users.auth_user_id` = the caller,
  and keeps only roles that are global (`access_roles.profile_id IS NULL`)
  *and* named in the closed allowlist `USER_LEVEL_GLOBAL_ROLE_NAMES` — today
  just `Platform Admin`. Both filters are load-bearing: the trigger also grants
  every user the global `Admin` role on their own profile, so "any global role
  on the own profile" would make everyone an admin everywhere, and "holds a
  permission on the `platform` zone" would escalate every user the moment one
  permission row on `Admin` were misconfigured.
- `isPlatformAdmin` is `checkPermission({ platform: ADMIN })` over those roles.
  `getMyAccount` returns them as `user.access`, so the UI gate is
  `user.access.platform.admin`.
- `getOrgAccessUser` and `getProfileAccessUser` OR the caller's user-level roles
  into the roles they return, fetched outside the durable cache so a grant needs
  no per-entity invalidation, and deduped by role id — on the own profile the
  membership row *is* the store, so both sources carry the role. Pure OR: a
  scoped override row on the role is rejected, so a profile can never narrow a
  platform grant.
- The role stays out of `EXPOSABLE_GLOBAL_ROLE_NAMES`, and the profile-membership
  assignment paths filter through `assignableRoleFilter`, so no invite or
  member-role UI can write it to an own-profile membership.
  `grantPlatformAdmin` / `revokePlatformAdmin` in `@op/common` are the only
  intended writers; they are not exposed through tRPC.
- The seed rows — the zone, the role and its four permission rows — reach every
  environment through `services/db/seed-access-control.ts`, which an operator
  runs. Seed data is not a schema change, so it does not belong in a Drizzle
  migration. The script is idempotent, and it aborts if a fixed seed id already
  belongs to a different zone or role rather than silently granting that other
  role.

## Consequences

- Superusers are granted by data, and the grant is expressed in the same model
  as every other permission — one place to read, one place to audit.
- The union widens a membership the caller already has; it does not create one.
  A platform admin with no membership row is still "not a member", so
  `assertOrgAccess` and `assertProfileAccess` reject them. Platform-wide
  routers keep their own all-entity queries.
- Enumeration and listing queries (proposal scope, instance lists, org member
  lists) are membership-driven and unchanged: a platform admin does not see
  every entity in a list.
- Consumers that need the membership identity row — `getCurrentOrgUserId`, any
  writer that stores a `profileUserId` — still require a real membership.
- The own-profile anchor lives in SQL, not in a table constraint. A role row
  written to the wrong membership grants nothing platform-wide, but the
  invariant is only as strong as that one query, so it carries an integration
  test rather than only unit coverage.
- Widening `USER_LEVEL_GLOBAL_ROLE_NAMES` widens what an own-profile membership
  row can do everywhere. It is a security decision, not a configuration one.
- The organization-membership assignment paths (`updateOrganizationUser`, and the
  allow-list `metadata.roleId` that `joinOrganization` reads) still validate a
  caller-supplied role id by existence alone. That cannot reach the own-profile
  anchor, so it grants no platform access, but it lets an org admin attach a
  system global role to an org membership. Left as it is here; worth its own
  change.
- Nothing applies the seed rows automatically outside docker dev, so a new
  environment is not a platform-admin environment until someone runs the seed.
  `getUserGlobalRoles` returns no roles until then, which fails closed.
- Rejected in this pull request: a `user_to_access_roles` table holding a role
  for a user directly. It read more explicitly, but the existing primitives
  already express the grant, and a new table costs a schema change, relations,
  and a second place where roles live.
