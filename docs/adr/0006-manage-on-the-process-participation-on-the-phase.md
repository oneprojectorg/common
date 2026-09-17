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

## Decision

1. **Manage resolves against the process profile. Submit, review and vote
   resolve against the phase. The two never union.** A process admin holds no
   participation by virtue of being an admin; they are invited to a phase like
   anybody else. The ADMIN bit must not short-circuit a capability check, which
   is the obvious implementation and the wrong one.
2. **Participation is:** the phase's state allows the capability, **and** the
   caller is signed in, **and** either they hold that capability on the phase
   profile, or the phase's audience is open and they can view the process.
3. **"Open" means open to whoever can view the process** — every signed-in user
   for a public process, the process's members for a private one. So an open
   phase needs no membership rows at all, and only invite-only phases put
   `profile_users` on a phase profile.
4. **The bits come from one profile-scoped role per capability the phase
   offers** — `access_roles.profile_id` set to the phase profile, permission set
   to that one bit plus READ, minted the way `createDecisionRole` already mints
   process roles. Per capability rather than per phase, because a phase holds
   reviewers and submitters at once and `profileUser_to_access_roles` is a join
   table. The invite therefore resolves its own `profile_invites.access_role_id`
   from the phase and the capability instead of asking an admin to pick a role.
5. **A phase grant confers view on a private process, materialised rather than
   derived.** The invite writes a read-only grant on the process profile, and
   losing the last phase grant revokes it. The alternative is a reverse lookup
   over every phase profile on a path that runs on every read.
6. **Anonymous callers top out at read, and only on a public process.** Submit,
   review and vote all need an identity to attach the artefact to.
7. **A review phase defaults to invite-only**, rather than inheriting the
   process's audience. An open review phase admits any signed-in viewer to score
   proposals: a correct capability and a bad default.

Two alternatives were rejected. **Per-profile override rows on the global Member
role**, scoped to the phase profile — the mechanism that makes a process public —
is cheaper, but gives a phase exactly one member shape, so it cannot hold
reviewers and submitters together. **New global Reviewer / Submitter / Voter
roles** read more simply, but put "pick a role" back into the invite UI, which is
the thing decision 4 removes.

## Consequences

Per-phase authorization becomes the mechanism we already have, and the invite UI
loses a question it could not answer well.

Cross-phase participation follows from decisions 2 and 5, and is intended:
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

`profiles` gains a role row and a permission row per capability per phase.
Process-level role editors must keep listing only the process profile's roles, or
phase roles surface where an admin cannot act on them.

The materialised process-level view grant is a fan-out write with a revoke rule.
Getting the revoke wrong leaves someone able to view a private process they were
removed from, and no foreign key catches it.

[ADR 0002](./0002-process-participant-for-notifications.md) defines a Participant
as process-level and explicitly "across all phases". Someone invited to a single
phase satisfies none of its clauses, as ADR 0005 already notes. This ADR does not
resolve that.

Two cases the matrix does not cover, taken as given here: a draft process is
admin-only regardless of the above, and an invitee keeps view on a private
process after their phase finishes.
