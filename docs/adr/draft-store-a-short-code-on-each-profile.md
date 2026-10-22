# NNNN. Store a short code on each profile

Date: 2026-10-22

## Status

Proposed

## Context

An object in Common needs a short, stable reference that a person can
type or read aloud. A printed ballot guide, an export, a spreadsheet
import and a text-message ballot all name a proposal by it; a text
command names a decision by it. An object's id is a UUID and its slug is
a sentence; neither can be typed on a phone. A short numeric code, `214`,
can. The ballot guide prints a proposal's code before voting opens, so
the code must name the same object for the life of its scope.

Every proposal, decision, organization and individual has one row in
`profiles`, typed by `entity_type`. A code on the profile covers every
object type with one mechanism and one foreign key.

## Decision

We will store the code on the profile. `profiles.short_code` is a
nullable integer. `profiles.short_code_scope_id` references the profile
the code is unique inside: a proposal's scope is its decision's profile;
a decision's scope is its organization's profile. The pair
`(short_code_scope_id, short_code)` is unique. `profiles.next_short_code`
is the counter on the scope row, default 101, so every code has at least
three digits.

`submitProposal` assigns a proposal's code inside the transaction that
moves the proposal to `submitted`. It locks the decision's profile row,
reads the counter, writes the code and the scope on the proposal's
profile, and advances the counter. A code never changes once set and is
never reused. A one-time script, `pnpm w:db
backfill:proposal-short-codes`, codes the submitted proposals that exist
before this change, in creation order.

## Consequences

- A printed guide stays valid for the life of the decision. A rejected or
  deleted proposal keeps its number, so the guide shows gaps.
- The unique index holds under concurrent assignment because the scope
  row is locked, not because callers check first.
- A code is meaningful only inside its scope. A reader resolves
  `(scope, code)` to a profile, then joins the object on `profile_id`.
- A draft has no code. Readers handle `null`.
- A decision code needs no schema change: the same three columns with the
  organization's profile as scope.
- `decision_process_instances.profile_id` is nullable. A decision with no
  profile has no scope row, so its proposals get no code; the backfill
  reports and skips it.
- Rejected: a column on each object table, `decision_proposals.short_code`
  and later `decision_process_instances.short_code`. Each needs its own
  counter and index, and a second code is a second migration.
- Rejected: a separate identifiers table with a polymorphic `subject_id`.
  No foreign key can enforce that the subject exists. The profile is the
  concrete table that already plays that role.
- Rejected: derive the code from row order. It needs no migration, but a
  rejection, a moderation hide or a hard delete renumbers every proposal
  after it.
- Rejected: encode an integer with Sqids (<https://sqids.org/>). Its
  alphabet mixes upper-case and lower-case letters with digits, so a code
  such as `Uk3f` needs the shift and symbol keys on a phone keypad. A
  three-digit number is typed from the numeric keypad alone. Sqids also
  needs a stored integer to encode, so it saves no column.
