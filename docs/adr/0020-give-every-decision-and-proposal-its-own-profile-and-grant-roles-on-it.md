# 0020. Give every decision and proposal its own profile and grant roles on it

Date: 2026-11-12

## Status

Accepted

## Context

A decision process has its own members: the people who run it, the people
who take part, sometimes the public. A proposal has its own members too: its
author and invited co-authors. Neither set is the member list of an
organization, and an organization's `Admin` and `Member` roles say nothing
about who may vote or review.

[0013](./0013-authorize-in-the-service-layer-with-access-zones.md) says where
a check runs. This records what the check is built from: which record holds
a grant, how a role is scoped, what the permission bits are, and how a
decision, a proposal and an organization fit into one model. This records
what the code already does.

## Decision

We will grant access on profiles. Every record that admits members owns a
`profiles` row, and a membership is a row on that profile. One mechanism
serves organizations, decisions and proposals.

### Profiles and memberships

`profiles.entity_type` (`type` in Drizzle) names what owns the profile:
`org`, `individual`, `decision`, `proposal` or `phase`, plus the deprecated
`user`. The owning record points at it:

| Record | Column |
| --- | --- |
| `organizations` | `profile_id` |
| `users` | `profile_id` (the individual), `current_profile_id` (the profile the user acts as) |
| `decision_process_instances` | `profile_id` (its own), `owner_profile_id` (the creator's individual profile), `steward_profile_id` (the profile the creator acted as) |
| `proposals` | `profile_id` (its own), `submitted_by_profile_id` |

A membership is a `profile_users` row (`auth_user_id`, `profile_id`,
`is_owner`) with roles in `profileUser_to_access_roles`. A phase profile
admits nobody; `assertProfileTypeAccess` throws on it, and lists exclude it.

Organization membership is the exception. It stays on `organization_users`
and `organizationUser_to_access_roles`, keyed on the auth user and the
organization, not on the organization's profile. `assertOrgAccess` reads it.
A lookup on an organization's profile sees no organization member.
`getProfileAccessRolesWithOrgFallback` falls back to the organization that
owns that profile. `assertInstanceProfileAccess` falls back to the
organization whose profile is the decision's `owner_profile_id`.

### Zones, bits and roles

A role grants a bitfield per zone. The zones are `profile`, `decisions` and
`admin` (organization member management). The bits are:

| Bit | Value | Zone |
| --- | --- | --- |
| `DELETE`, `UPDATE`, `READ`, `CREATE`, `ADMIN` | 1, 2, 4, 8, 16 | every zone |
| `INVITE_MEMBERS`, `REVIEW`, `SUBMIT_PROPOSALS`, `VOTE` | 32, 64, 128, 256 | `decisions` only |

The standard bits come from `access-zones`. The decision bits are
`decisionPermission` in `packages/common/src/services/decision/permissions.ts`,
duplicated in `services/db/seedData/accessControl.ts` because `@op/db`
cannot import `@op/common`. A caller's roles are unioned, so a bit granted
by any role is granted.

A role is global or scoped. `access_roles.profile_id` is `NULL` for a global
role and set for a role that exists on one profile. The seed creates three
global roles:

| Role | `profile` | `decisions` | `admin` |
| --- | --- | --- | --- |
| `Admin` | ACRUD | ACRUD | ACRUD |
| `Member` | `READ` | `READ`, `UPDATE`, `SUBMIT_PROPOSALS`, `VOTE` | none |
| `Public` | none | none | none |

`createDefaultDecisionRoles` gives every new decision two roles scoped to
its profile: `Admin` (ACRUD on `profile`, every bit on `decisions`) and
`Participant` (`READ` on `profile`; `READ`, `SUBMIT_PROPOSALS`, `VOTE` on
`decisions`). A `profile: ADMIN` on the decision adds more through `createRole` and
`updateDecisionRoles`. `createRole` and `createDecisionRole` add
`profile: READ` to every scoped role, and `updateDecisionRoles` adds `READ`
to the `decisions` bitfield, so a role made through them always lets its
holder see the decision.

A permission row, `access_role_permissions_on_access_zones`, is global or
scoped in the same way. A row with `profile_id` set overrides the global row
of the same role and zone on that profile only.
`pickEffectivePermissionRows` applies the rule: a scoped row never counts on
another profile, and with no profile in play only global rows count. Only a
global role carries scoped rows; a scoped role is scoped already.

### Public access

`GLOBAL_USER_PUBLIC` is a sentinel auth user. `resolveAccessUserIds` turns
every caller into the pair of their own id and the sentinel, or the sentinel
alone when there is no user. Every grant lookup filters on that set, so a
grant to the sentinel reaches members, signed-in non-members and visitors
alike, and a missing user can never drop the filter.

The `Public` role has no global permission rows, so the grant alone opens
nothing. `makeDecisionPublic` opens one published decision: it adds a
`profile_users` row for the sentinel on the decision's profile, links it to
`Public`, and writes a scoped override on `decisions` with `READ` plus
optional `SUBMIT_PROPOSALS` and `VOTE`. `removeDecisionPublicAccess` deletes
both. Only a platform admin may call either.

### Who is granted what

`createDecisionInstance` creates the profile, the instance, the two scoped
roles and the creator's membership in one transaction. The creator gets a
`profile_users` row with `is_owner` and the decision's scoped `Admin` role. `owner_profile_id` is their individual
profile and `steward_profile_id` is the profile they acted as. `createProposal`
does the same for a proposal: the creator gets a `profile_users` row with
`is_owner` and the global `Admin` role on the proposal's profile. A co-author accepts a proposal
invite, which `acceptProposalInvite` turns into a `profile_users` row on the
proposal and, when they have none, a row on the decision with the global
`Member` role. Everyone else joins a decision through a profile invite,
which `acceptProfileInvite` turns into a `profile_users` row, or through the
public grant.

A participant, for notifications, is a member of the decision's profile or
anyone attached to a proposal in it
([0002](./0002-process-participant-for-notifications.md)). Voter enrolment
is a separate record, checked at vote time, not a grant.

### The check per action

Reads of a decision go through `assertInstanceProfileAccess`: the decision's
profile first, then the organization whose profile is `owner_profile_id`.
Writes to the decision check the decision's profile only.

| Action | Profile checked | Permission | Organization fallback |
| --- | --- | --- | --- |
| View a decision, its voting status, its proposals | decision | `decisions: READ` | `decisions: READ` |
| Create a proposal | decision | `profile: ADMIN` or `SUBMIT_PROPOSALS` | `profile: ADMIN` |
| Like or follow a proposal | decision | `SUBMIT_PROPOSALS` | `SUBMIT_PROPOSALS` or `decisions: ADMIN` |
| Comment on a proposal | decision | `profile: ADMIN` or `SUBMIT_PROPOSALS` | no |
| Submit a proposal | decision | `profile: ADMIN` or `SUBMIT_PROPOSALS` | no |
| Vote | decision | `VOTE` or `decisions: ADMIN` | no |
| Edit a decision, advance a phase | decision | `decisions: ADMIN` | no |
| Delete a decision | decision | `decisions: DELETE` or `ADMIN` | no |
| Change the steward | owner | `profile: ADMIN` | no |
| Edit proposal content | proposal, then decision | `profile: UPDATE` on the proposal, or `decisions: UPDATE` on the decision | no |
| Change proposal status or visibility | decision | `decisions: ADMIN` | no |
| Delete a proposal | proposal and decision | submitter, `profile: ADMIN` on the proposal, or `decisions: ADMIN` on the decision | no |

A draft, hidden or flagged proposal is hidden with `NotFoundError`. A draft
is visible only to members of the proposal's profile, decision admins
included in the denial. A hidden or flagged proposal is visible to those
members and to decision admins. After submission, content edits also need the
phase to allow them, a decision admin, or an open revision request.

### Caches and the client

A grant lookup is memoized per request and cached durably, keyed by the
profile and the resolved id set. Every write that changes a membership, a
role or a permission row invalidates it: `invalidateProfileUserAccessCache`
for one member, `invalidateProfileUserCacheForRole` for a role,
`invalidateProfileUserCacheForProfile` for a profile, sentinel included.

The server computes what the client may do, as `access`, a boolean per bit.
`getInstance` returns all true for a `profile: ADMIN` on the decision,
otherwise the union of the roles' `decisions` bits, from the organization's
roles when the caller has no row on the decision. `getProposal` reads the
proposal's own profile: its `decisions` bits, `admin` when the caller is a
`profile: ADMIN` there, and `submitProposals` also when the caller may
comment on the decision. Decision and proposal pages read `access`.
Organization and profile pages, and the process builder, read
`getPermissionsForProfile` from `UserProvider`, which `<AccessBoundary>`
wraps; it knows `profile_users` and `organization_users` rows, nothing else.

## Consequences

- One membership mechanism covers an organization, a decision and a
  proposal, and a decision can define its own roles.
- Public access is a grant on one profile, so it is listed, revoked and
  cached like any other, and it never widens another decision.
- A proposal has a member list of its own, so a draft is visible to its
  co-authors and to nobody else, decision admins included. Accepting a
  proposal invite also makes the co-author a `Member` of the decision.
- The organization fallback applies to reads, proposal creation, likes and
  follows only. An organization admin with no row on a decision's profile
  can view it and create a proposal, but cannot comment, submit, vote, edit
  or delete.
- The fallback works only when `owner_profile_id` is an organization's
  profile. A decision created today owns an individual profile there, so
  only older, organization-owned decisions reach it.
- `profile: ADMIN` and `decisions: ADMIN` are both an admin. Which one an
  action checks is set per service, and the two are not interchangeable.
- `decision_process_instances.profile_id` is nullable, so every service
  checks it and throws before the grant lookup.
- Organization membership is not a profile membership. A new profile-level
  lookup on an organization's profile needs the fallback helper, or it sees
  nobody.
- Invalidation is manual. A write that changes a grant and skips it serves
  the old roles until the cache expires.
- `organization/relationships.ts` still treats every organization member as
  an admin, marked as a TODO.
