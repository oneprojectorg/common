# 0002. Derive the participant notification audience from existing rows

Date: 2026-08-30

## Status

Accepted

## Context

Process-wide notification emails (phase transitions today, updates later) went
only to `profileUsers` rows on the process profile — the Members panel (~20
people on Columbus). The ~670 people whose only tie to the process is a
submitted proposal got nothing: `createProposal` writes their `profileUsers`
row on the proposal's profile, and public access is a role-by-name with no
own-grant. They must be emailed, and no record exists at all of "joined the
public process but never submitted".

## Decision

We will derive the audience of a process-wide email at send time, from rows we
already have, instead of introducing a follower/subscriber table. The audience
is the **Participant** set: process-profile members ∪ submitters and invited
collaborators on any non-draft, non-deleted proposal in the instance — any
phase, hidden proposals included. One generic service
(`listProcessParticipants` in `@op/common`) computes it: distinct
participants with their contact data (email today; a preferred channel such
as SMS can join later), no caching, no exclusions. Each sender filters for
the contact data it needs — the email sender keeps only participants with an
email. `listProposalSubmitters` is not reused; it is phase-scoped, cached,
and shaped for the face-pile.

We will also log, not throw, when a Resend batch inside a bulk send partially
fails. A throwing send step makes Inngest retry the whole step and re-send
every already-delivered email; at ~690 recipients a duplicate blast is a worse
failure than a logged gap of at most 100 addresses that can be re-sent by
hand. Per-chunk `step.run` sends are the durable fix, tracked separately
(Asana 1217973315174488).

A follower table written on join and submit remains the correct long-term
shape, but it cannot backfill the people who already submitted without a
derivation rule — and that rule is exactly this union. Revisit when "joined
but never submitted" must become reachable.

## Consequences

- The ~670 Columbus submitters receive phase-transition emails with no schema
  change and no backfill.
- A person who joined a public process but never submitted stays unreachable;
  the model cannot see them.
- Hiding a proposal does not silence its authors — gallery moderation and
  process communication stay different acts. Anonymous submitters are in the
  participant set but drop out of email sends (NULL email) until another
  channel exists.
- A failed batch means up to 100 people miss an email, with only a log line to
  show for it, until the per-chunk retry fix lands.
- No unsubscribe mechanism ships with this; it stays a separate ticket.
