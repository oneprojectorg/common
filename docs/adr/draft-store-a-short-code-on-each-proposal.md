# NNNN. Store a short code on each proposal for text-message ballots

Date: 2026-10-22

## Status

Accepted

## Context

A member who votes by text names a proposal with a short number, `214`,
typed on a phone. The number is printed in a ballot guide before voting
opens and must mean the same proposal for the life of the decision. A
proposal has no such identifier: its id is a UUID and its profile slug is
a sentence.

A number derived from row order is not stable. The first SMS ballot
derived codes over the eligible proposals, so a rejection or a moderation
hide renumbered every proposal after it. Numbering every row instead still
shifts on a hard delete, which `deleteProposal` performs at any phase.

## Decision

We will store the code. `decision_proposals.short_code` is a nullable
integer, unique per `(process_instance_id, short_code)`.
`decision_process_instances.next_short_code` is the per-decision counter,
default 101, so every code has at least three digits.

A service assigns codes in creation order inside one transaction that
locks the instance row. It runs at the transition into a voting phase and
again whenever a ballot is listed, so a late proposal gets the next code
and a code never changes once set. Codes are never reused.

## Consequences

- A printed guide stays valid for the life of the decision. A rejected or
  deleted proposal keeps its number, so the guide shows gaps.
- The unique index holds under concurrent assignment because the counter
  row is locked, not because callers check first.
- A code is meaningful only inside its decision. A reader joins on the
  instance.
- A proposal has no code until the first assignment. Readers handle `null`.
- Rejected: derive the code from `row_number()` over all rows. It needs no
  migration, but it depends on a guard in `deleteProposal` and on a
  convention no table column records.
