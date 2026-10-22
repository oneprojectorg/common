# NNNN. Store a short code on each proposal for text-message ballots

Date: 2026-10-22

## Status

Proposed

## Context

A member who votes over SMS or WhatsApp selects a proposal by typing an
identifier. A proposal's id is a UUID and its slug is a sentence; neither
can be typed on a phone. A short numeric code, `214`, can. The code is
printed in the ballot guide before voting opens, so it must name the same
proposal for the life of the decision.

## Decision

We will store the code. `decision_proposals.short_code` is a nullable
integer, unique per `(process_instance_id, short_code)`.
`decision_process_instances.next_short_code` is the per-decision counter,
default 101, so every code has at least three digits.

`submitProposal` assigns the next code inside the transaction that moves
the proposal to `submitted`. It locks the instance row, reads the counter,
writes the code and advances the counter. A code never changes once set
and is never reused. A one-time script, `pnpm w:db
backfill:proposal-short-codes`, codes the submitted proposals that exist
before this change, in creation order.

## Consequences

- A printed guide stays valid for the life of the decision. A rejected or
  deleted proposal keeps its number, so the guide shows gaps.
- The unique index holds under concurrent assignment because the counter
  row is locked, not because callers check first.
- A code is meaningful only inside its decision. A reader joins on the
  instance.
- A draft has no code. Readers handle `null`.
- Rejected: derive the code from row order. It needs no migration, but a
  rejection, a moderation hide or a hard delete renumbers every proposal
  after it.
