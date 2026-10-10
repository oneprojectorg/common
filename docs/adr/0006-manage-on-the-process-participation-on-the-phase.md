# 6. Manage resolves against the process, participation against the phase

Date: 2026-09-17

## Status

Proposed

## Context

[ADR 0005](./0005-phases-are-entities-with-their-own-profiles.md) gives a phase a
profile so that it can hold a role grant, and scopes itself to identity only. It
says nothing about how a request then resolves. That is the remaining question,
and the answer is not the one the shape suggests.

Every decision capability resolves against the process profile today:
`assertInstanceProfileAccess` uses `instance.profileId`, and the decisions zone
carries the capability bits — `INVITE_MEMBERS`, `REVIEW`, `SUBMIT_PROPOSALS`,
`VOTE` — on a *role*, not on a membership. No seeded role fits per-phase use:
global Member on the decisions zone is
`READ | UPDATE | SUBMIT_PROPOSALS | VOTE` and carries **no** REVIEW bit, so
inviting a reviewer as Member grants submit and vote and not review — precisely
inverted.

The process builder port needs per-phase audiences and invitees, which forces
the question. It was settled against a matrix of the four combinations: public or
private process, open or invite-only phase.

### The matrix

These four tables are the acceptance criteria; the decisions below are the
reasoning. "Process perms" is any grant on the process profile short of admin.
An open phase has no membership rows at all (decision 4), so its "phase perms"
rows are `n/a` rather than denied.

**Public process — open phase**

| Caller | View | Submit | Vote | Review | Manage |
| --- | --- | --- | --- | --- | --- |
| Signed out | ✓ | ✗ | ✗ | ✗ | ✗ |
| Signed in, no perms | ✓ | ✓ | ✓ | ✓ | ✗ |
| Signed in, process perms | ✓ | ✓ | ✓ | ✓ | ✗ |
| Signed in, phase perms | n/a | n/a | n/a | n/a | n/a |
| Process admin | ✓ | ✓ | ✓ | ✓ | ✓ |

**Public process — invite-only phase**

| Caller | View | Submit | Vote | Review | Manage |
| --- | --- | --- | --- | --- | --- |
| Signed out | ✓ | ✗ | ✗ | ✗ | ✗ |
| Signed in, no perms | ✓ | ✗ | ✗ | ✗ | ✗ |
| Signed in, process perms | ✓ | ✗ | ✗ | ✗ | ✗ |
| Signed in, phase perms | ✓ | ✓ | ✓ | ✓ | ✗ |
| Process admin, no phase perms | ✓ | ✗ | ✗ | ✗ | ✓ |
| Process admin, phase perms | ✓ | ✓ | ✓ | ✓ | ✓ |

**Private process — open phase**

| Caller | View | Submit | Vote | Review | Manage |
| --- | --- | --- | --- | --- | --- |
| Signed out | ✗ | ✗ | ✗ | ✗ | ✗ |
| Signed in, no perms | ✗ | ✗ | ✗ | ✗ | ✗ |
| Signed in, process perms | ✓ | ✓ | ✓ | ✓ | ✗ |
| Signed in, phase perms | n/a | n/a | n/a | n/a | n/a |
| Process admin | ✓ | ✓ | ✓ | ✓ | ✓ |

**Private process — invite-only phase**

| Caller | View | Submit | Vote | Review | Manage |
| --- | --- | --- | --- | --- | --- |
| Signed out | ✗ | ✗ | ✗ | ✗ | ✗ |
| Signed in, no perms | ✗ | ✗ | ✗ | ✗ | ✗ |
| Signed in, process perms | ✓ | ✗ | ✗ | ✗ | ✗ |
| Signed in, phase perms | ✓ | ✓ | ✓ | ✓ | ✗ |
| Process admin, no phase perms | ✓ | ✗ | ✗ | ✗ | ✓ |
| Process admin, phase perms | ✓ | ✓ | ✓ | ✓ | ✓ |

## Decision

1. **Manage resolves against the process profile. Submit, review and vote
   resolve against the phase. The two never union.** A process admin holds no
   participation by virtue of being an admin; they are invited to a phase like
   anybody else. The ADMIN bit must not short-circuit a capability check, which
   is the obvious implementation and the wrong one. Manage means the process's
   **admin role specifically**, not any grant on the process profile.
2. **Participation is:** the phase's state allows the capability, **and** the
   caller is signed in, **and** either they hold that capability on the phase
   profile, or the phase's audience is open and they can view the process.
3. **View resolves against the process alone. No property of a phase affects
   it, and invite-only constrains participation only — never visibility.** A
   public process's phases are all visible to everyone including anonymous
   callers, invite-only ones included; a private process's phases are all
   visible to anyone holding anything anywhere in that process, and to nobody
   else. So answering "may this caller see this phase" never reads a phase
   profile, which is what decision 6 exists to guarantee.
4. **"Open" means open to whoever can view the process** — every signed-in user
   for a public process, the process's members for a private one. So an open
   phase needs no membership rows at all, and only invite-only phases put
   `profile_users` on a phase profile.
5. **Capability bits attach directly to the phase profile. There is no
   intermediary role.** A grant is a permission on (profile, zone) held by a
   user, not a role the user is then joined to. The bits are the ones the
   decisions zone already defines, so capabilities collapse and combine in one
   bitfield: a phase holding reviewers and submitters at once needs no separate
   object per capability. The invite therefore carries a permission rather than
   resolving an `access_role_id`, which is the question an admin could not
   answer well.
6. **A phase grant confers view on a private process, materialised rather than
   derived — and it is the only way a participant holds anything on the
   process profile.** The invite writes a read-only grant there, and losing the
   last phase grant revokes it. The alternative is a reverse lookup over every
   phase profile on a path that runs on every read.

   **There is no direct process membership.** Nobody is invited to a process;
   they are invited to a phase, and process view falls out of that. The sole
   exception is the admin role, which is a direct grant on the process profile
   and must stay one — otherwise an admin who was never invited to a phase
   cannot view their own private process. So `canViewProcess` is one lookup on
   the process profile: public, or any grant there.
7. **Anonymous callers top out at read, and only on a public process.** Submit,
   review and vote all need an identity to attach the artefact to.
8. **A review phase defaults to invite-only**, rather than inheriting the
   process's audience. An open review phase admits any signed-in viewer to score
   proposals: a correct capability and a bad default.

Three alternatives were rejected, all of them role-based. **Per-profile
override rows on the global Member role**, scoped to the phase profile — the
mechanism that makes a process public — is cheaper, but gives a phase exactly
one member shape, so it cannot hold reviewers and submitters together. **New
global Reviewer / Submitter / Voter roles** read more simply, but put "pick a
role" back into the invite UI, which is the thing decision 5 removes. **One
profile-scoped role per capability, minted per phase the way
`createDecisionRole` mints process roles**, was this ADR's original decision 5
and was reversed on 2026-09-22: it works, but it creates a role and a
permission row per capability per phase to express a grant the permission
system can hold directly, and it leaves every consumer resolving a role id to
find out what someone may do.

## Consequences

Per-phase authorization becomes the mechanism we already have, and the invite UI
loses a question it could not answer well.

Cross-phase participation follows from decisions 2 and 6, and is intended:
someone invited to phase 1 of a private process thereby holds view on it, so an
open phase 3 admits them. An admin who does not want that sets the phase to
invite-only.

A role is necessary but not sufficient. Phase state stays a separate gate in the
service layer, so a grant on a closed phase carries the bit and still cannot
act — two gates that have to stay in step.

Every decision capability check now needs a phase in hand. Call sites that pass
`instance.profileId` have to be found and changed, and the ones that are really
Manage checks have to be told apart from the ones that are really participation
checks.

A new profile type is ungated until something gates it.
`assertProfileTypeAccess` treats a type absent from its policy map as a no-op,
deliberately, so the change introducing the phase type has to give it a policy
at every call site in the same change. Omitting one is neither a compile error
nor a runtime error — it is a read that succeeds and should not have.

Process-level role editors must keep listing only the process profile's own
grants, or phase grants surface where an admin cannot act on them.

Decision 5 needs a primitive the permission layer does not have: access-zones
attaches permissions to roles, not to a profile directly, and
`profile_invites.access_role_id` is non-nullable and assumes a role exists to
point at. Both have to be built before any of this can ship.

Existing process-level grants that carry participation bits contradict decision
6 and cannot stay where they are — the seeded `Participant` role is one. Finding
them, and deciding what happens to the people holding them, is migration work
this ADR does not do.

A phase's audience is an authorization input, not configuration. Decision 2
reads it on every participation check and decision 8 wants it to default to
invite-only, so it needs storage that can express a default and cannot be
absent. A key in a payload defaulting to `{}` is neither, and the permissive
reading of an unset audience opens a private process to any signed-in viewer.
It has to fail closed by construction rather than by convention.

The materialised view grant is a fan-out write with a revoke rule, and getting
the revoke wrong leaves someone viewing a private process they were removed
from, with no foreign key to catch it. A database cascade does not help: the
grant lives on the process profile, so deleting a phase profile leaves it
behind. Phase deletion has to run the revoke itself.

[ADR 0002](./0002-process-participant-for-notifications.md) defines a Participant
as process-level and explicitly "across all phases". Someone invited to a single
phase satisfies none of its clauses, as ADR 0005 already notes. This ADR does not
resolve that.

Two cases the matrix does not cover, taken as given here: a draft process is
admin-only regardless of the above, and an invitee keeps view on a private
process after their phase finishes.
