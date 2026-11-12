# 0020. Give every decision and proposal its own profile and grant roles on it

Date: 2026-11-12

## Status

Accepted

## Context

A decision has its own members: the people who run it, the people who take
part, sometimes the public. A proposal has its author and co-authors. Neither
set is an organization's member list, and an organization's roles say nothing
about who may vote or review.

[0013](./0013-authorize-in-the-service-layer-with-access-zones.md) says where
a check runs. This records what it is built from.

## Decision

We will grant access on profiles. Every record that admits members owns a
`profiles` row, and a membership is a row on that profile. Organizations keep
their own membership table.

### Profiles and memberships

`profiles.entity_type` is `org`, `individual`, `decision`, `proposal` or
`phase` (plus the deprecated `user`). The owning record points at the profile:

| Record | Column |
| --- | --- |
| `organizations` | `profile_id` |
| `users` | `profile_id` (the individual), `current_profile_id` (the profile the user acts as) |
| `decision_process_instances` | `profile_id` (its own), `owner_profile_id` (the creator's individual profile; an organization's profile on older decisions), `steward_profile_id` (the profile that runs it) |
| `proposals` | `profile_id` (its own), `submitted_by_profile_id` |

A membership is a `profile_users` row with roles in
`profileUser_to_access_roles`. A phase profile admits nobody.

Organization membership stays on `organization_users` and
`organizationUser_to_access_roles`, keyed on the organization, not its
profile. A lookup on an organization's profile sees no organization member,
so `assertInstanceProfileAccess` falls back to the organization whose profile
is the decision's `owner_profile_id`.

### Zones, bits and roles

A role grants a bitfield per zone. The zones are `profile`, `decisions` and
`admin` (organization member management). A caller's roles are unioned.

| Bit | Value | Zone |
| --- | --- | --- |
| `DELETE`, `UPDATE`, `READ`, `CREATE`, `ADMIN` | 1, 2, 4, 8, 16 | every zone |
| `INVITE_MEMBERS`, `REVIEW`, `SUBMIT_PROPOSALS`, `VOTE` | 32, 64, 128, 256 | `decisions` only |

A role is global (`access_roles.profile_id` is `NULL`) or scoped to one
profile. The seed creates three global roles:

| Role | `profile` | `decisions` | `admin` |
| --- | --- | --- | --- |
| `Admin` | ACRUD | ACRUD | ACRUD |
| `Member` | `READ` | `READ`, `UPDATE`, `SUBMIT_PROPOSALS`, `VOTE` | none |
| `Public` | none | none | none |

Every new decision gets two roles scoped to its profile: `Admin` (ACRUD on
`profile`, every bit on `decisions`) and `Participant` (`READ` on `profile`;
`READ`, `SUBMIT_PROPOSALS`, `VOTE` on `decisions`). A `profile: ADMIN` on the
decision adds and edits roles. `createRole`, `createDecisionRole` and
`updateDecisionRoles` force `READ` in; `updateRolePermissions` does not.

A permission row (`access_role_permissions_on_access_zones`) with
`profile_id` set overrides the global row of the same role and zone on that
profile only. It never counts elsewhere, and only a global role carries one.

### Public access

`GLOBAL_USER_PUBLIC` is a sentinel auth user. Every grant lookup filters on
the caller's id plus the sentinel, or the sentinel alone with no user, so a
grant to the sentinel reaches everyone and a missing user never drops the
filter.

`Public` has no global permission rows, so the grant alone opens nothing.
`makeDecisionPublic` adds a `profile_users` row for the sentinel on one
published decision, links it to `Public`, and writes a scoped override on
`decisions` with `READ` plus optional `SUBMIT_PROPOSALS` and `VOTE`.
`removeDecisionPublicAccess` deletes both. Only a platform admin may call
either.

### Who is granted what

The creator of a decision gets a `profile_users` row with `is_owner` and the
decision's scoped `Admin` role, in the transaction that creates the decision.
The creator of a proposal gets the same on the proposal's profile, with the
global `Admin` role. A co-author who accepts a proposal invite gets a row on
the proposal and, if they have none, a row on the decision with the role of
their pending decision invite, or `Member`. Everyone else joins a decision by
profile invite or the public grant. Voter enrolment is a separate record,
checked at vote time, not a grant.

### The check per action

Reads by id, proposal creation, review management and custom forms go
through `assertInstanceProfileAccess`: the decision's profile first, then the
organization fallback. The read by slug, exports and the lifecycle writes
below check the decision's profile only.

| Action | Profile checked | Permission | Organization fallback |
| --- | --- | --- | --- |
| View a decision by id, its voting status, results and proposals | decision | `decisions: READ` | `decisions: READ` |
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
| Delete a proposal | proposal and decision | the submitting profile, `profile: ADMIN` on the proposal, or `decisions: ADMIN` on the decision | no |

A draft is visible only to the proposal's members. A hidden or flagged
proposal is visible to them and to a `profile: ADMIN` on the decision. Both
are hidden with `NotFoundError`. After submission, content edits also need
the phase to allow them, a decision admin, or an open revision request.

### Caches and the client

Grant lookups are memoized per request and cached durably per profile and
caller. A write that changes a membership, a role or a permission row must
call `invalidateProfileUserCacheForRole`, `invalidateProfileUserCacheForProfile`
or `invalidateProfileUserAccessCache`; only the last clears the per-request
memo. Organization grants have their own `orgUser` cache.

The server returns `access`, a boolean per bit, with each decision and
proposal, and the client reads it. `getInstance` returns all true for a
`profile: ADMIN`, else the roles' `decisions` bits. `getPermissionsOnProposal`
reads the proposal's profile, plus `submitProposals` from the decision.
Organization and profile pages read `getPermissionsForProfile` from
`UserProvider`, which knows only `profile_users` and `organization_users`.

## Consequences

- A decision defines its own roles, and a proposal has a member list of its
  own, so a draft is visible to co-authors and nobody else.
- Public access is a grant on one profile, revoked and cached like any other.
- A co-author becomes a `Member` of the decision, and `Member` carries
  `decisions: UPDATE`, which lets them edit any proposal while the phase
  allows edits.
- The organization fallback fires only when `owner_profile_id` is an
  organization's profile, so only older decisions reach it. Where it fires,
  it admits an organization admin to reads and proposal creation but not to
  the lifecycle writes.
- `profile: ADMIN` and `decisions: ADMIN` are not interchangeable, and which
  one an action checks is set per service.
- `decision_process_instances.profile_id` is nullable, so every service
  checks it before the grant lookup.
- Invalidation is manual. `assignRoleToUser` skips it today, and a skipped
  write serves old roles until the cache expires.
- `organization/relationships.ts` still treats every organization member as
  an admin.
