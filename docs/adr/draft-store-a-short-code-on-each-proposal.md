# NNNN. Store a short code on each proposal

Date: 2026-10-23

## Status

Proposed

## Context

A proposal needs a short, stable reference that a person can type or
read aloud. A printed ballot guide, an export, a spreadsheet import and a
text-message ballot all name a proposal by it. A proposal's id is a UUID
and its slug is a sentence; neither can be typed on a phone. A short
numeric code, `214`, can. The ballot guide prints a proposal's code
before voting opens, so the code must name the same proposal for the life
of its decision.

The code is unique inside one decision: two decisions each print their
own `214`. A decision is identified by its bound chat line or its slug,
so it needs no code of its own today.

An earlier cut of this change stored the code, a scope reference and the
counter on `profiles`, as one mechanism for every object type. Review
found that it overloads the identity row every object shares with three
columns, a self-referencing foreign key and a check constraint, for a
need that only proposals have, and that every lookup joins through
`profiles` twice.

## Decision

We will store the code on the proposal. `decision_proposals.short_code`
is a nullable integer; a draft has none. The pair
`(process_instance_id, short_code)` is unique among coded rows.
`decision_process_instances.next_short_code` is the counter on the
decision row, default 101, so every code has at least three digits.

`submitProposal` assigns the code inside the transaction that moves the
proposal to `submitted`. It locks the decision row with
`lockProcessInstance`, reads the counter, writes the code on the proposal
and advances the counter. A code never changes once set and is never
reused. A one-time script, `pnpm w:db backfill:proposal-short-codes`,
codes the submitted proposals that exist before this change, in creation
order.

## Consequences

- A printed guide stays valid for the life of the decision. A rejected or
  deleted proposal keeps its number, so the guide shows gaps.
- The unique index holds under concurrent assignment because the decision
  row is locked, not because callers check first.
- A code is meaningful only inside its decision. A reader resolves
  `(process_instance_id, short_code)` directly on `decision_proposals`.
- A draft has no code. Readers handle `null`.
- The code lives outside `proposalColumns`, so the proposal history
  trigger does not copy it; a code is not a revision of the proposal.
- Deleting a decision deletes its proposals and their codes with them.
- A decision code, if one is ever needed, is the same pattern on the next
  level: a nullable column on `decision_process_instances` and a counter
  on the organization. It is not added until a command needs it.
- Rejected: columns on `profiles` with a scope reference. One mechanism
  for every object type, but it puts SMS-driven columns on the shared
  identity row, needs a self-referencing foreign key and a check
  constraint to keep code and scope together, and resolves a code
  through two profile joins.
- Rejected: a separate identifiers table with a polymorphic `subject_id`.
  No foreign key can enforce that the subject exists.
- Rejected: derive the code from row order. It needs no migration, but a
  rejection, a moderation hide or a hard delete renumbers every proposal
  after it.
- Rejected: a Postgres `serial`. One sequence spans the whole table, so
  codes do not restart at 101 per decision and grow past three digits.
  Per-decision sequences would mean a `CREATE SEQUENCE` per decision with
  nothing to drop it.
- Rejected: encode an integer with Sqids (<https://sqids.org/>). Its
  alphabet mixes upper-case and lower-case letters with digits, so a code
  such as `Uk3f` needs the shift and symbol keys on a phone keypad. A
  three-digit number is typed from the numeric keypad alone. Sqids also
  needs a stored integer to encode, so it saves no column.
