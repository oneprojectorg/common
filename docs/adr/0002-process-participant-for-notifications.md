# 0002. A process participant, for notification purposes, is anyone who joined or contributed

Date: 2026-08-30

## Status

Accepted

## Context

When a decision process speaks to "everyone" — a phase transition today, an
admin update tomorrow — who is everyone? Until now the answer was the Members
panel: the small group deliberately added to the process. But a public process
accumulates a far larger circle of people who were never added to anything:
they arrived through the public link and submitted or co-authored a proposal.
They have a real stake in the process — a phase change decides the fate of
their proposal — yet no standing in its membership model. This is the crux of
the public/private distinction: in a private process, contributing requires
membership, so members *are* the audience; a public process decouples
contribution from membership, and the audience question appears.
There is also a third circle we cannot see at all: people who visited a public
process and never submitted. Joining leaves no record.

## Decision

We define the **Participant** of a process, for notification purposes, as:

> anyone who is a member of the process, or who submitted or was invited to
> collaborate on any of its proposals.

The boundary choices, each a deliberate one:

- **Contribution confers standing, in any phase.** A submitter from the first
  phase stays a participant for the life of the process, whether or not their
  proposal advanced. The people whose proposals did not survive a transition
  are exactly the people the transition email owes an explanation.
- **A draft is not a contribution.** Someone who started a proposal and never
  submitted it has not entered the process; deleting a proposal likewise
  withdraws it. Both are outside the set.
- **Moderation is not exclusion.** Hiding a proposal from the public gallery
  is an act about the proposal, not about its authors' membership in process
  communication. Authors of hidden proposals remain participants.
- **Anonymity does not reduce standing.** An anonymous submitter is a full
  participant; they are simply unreachable on channels they never provided.
  Reachability is a property of the channel, not of participation.
- **Participation is derived, not subscribed.** The set is computed from the
  records participation already leaves behind (membership, proposals), never
  from a separate follow/subscribe action. Nobody must opt in to hear about a
  process they contributed to — and consequently the silent third circle,
  people who joined but never contributed, is not in the set, because their
  joining leaves nothing to derive from.

The definition does not branch on process visibility. In a private process it
collapses naturally to the members and their invited collaborators; in a
public one it widens to every contributor. One rule, no per-process special
cases.

Everyone in the set is treated alike: no notification tiers, and the admin
who triggered the event is as much a recipient as anyone else.

## Consequences

- Everyone who has already contributed to any existing process is reachable
  immediately — the definition covers them retroactively, which a
  subscription model could not without inventing this same rule as its
  backfill.
- "Joined but never contributed" stays invisible. If those people must ever
  be reachable, participation has to start leaving a record at join time —
  that is a new decision, superseding the derivation rule here.
- The definition is channel-neutral: it names people, not addresses. Each
  channel reaches the participants it can (today email; an anonymous account
  has none), and adding a channel later widens reach without touching the
  definition.
- No unsubscribe exists yet; leaving the set currently means leaving the
  process. An opt-out is a future, separate concern layered on top of the
  definition, not part of it.
