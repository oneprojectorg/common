# 0020. Delete through the profile cascade, and declare a rule on every foreign key

Date: 2026-11-12

## Status

Proposed

## Context

The service layer deletes an organization, a decision, or a phase by deleting
its profile row. The foreign keys do the rest: 100 of the 126 `on delete`
rules in `services/db/schema` are `cascade`, 47 foreign keys point at
`profiles`, and one profile delete transitively reaches 51 tables.

This mechanism is implicit. A new table that references `profiles`, `posts`,
or `proposals` without an `on delete` rule defaults to `NO ACTION` and blocks
`deleteOrganization`, `deleteDecision`, `deletePhase`, and `deletePost` the
first time it holds a row. The blast radius is also large and grows with every
table: a single `db.delete(profiles)` removes content across those 51 tables
in one statement, with no undo and no trace.

In scope: how entities are deleted, and what rule a new foreign key declares.

## Decision

We will keep the profile cascade as the delete mechanism, and we will not add
a foreign key without an explicit `on delete` rule.

A new foreign key declares:

- `cascade` when the row is part of the deleted thing's world and should die
  with it (memberships, reactions, phases, votes).
- `set null` on an attribution column, where the record outlives the person
  (`addedBy`, `triggeredBy`, `flaggedBy`, `steward`).
- `restrict` only on reference data that nothing routinely deletes (storage
  objects, taxonomies, form schemas).

A table whose rows must survive the subject's deletion — an audit trail, an
activity feed — says so in its own ADR and uses `set null` with a snapshot,
never a bare foreign key.

## Consequences

- One delete removes an entity and everything under it. No orphan sweeps, no
  partial states.
- The blast radius is already large and this ADR ratifies it: a mistaken or
  malicious profile delete destroys rows in up to 51 tables, and a backup is
  the only recovery. A soft-delete migration would change this; that is its
  own decision.
- Nothing survives as history. Feeds, counts, and audit records vanish with
  their subject unless a table opts out explicitly.
- Review gains a checkable rule: a schema PR with a bare foreign key is wrong,
  whatever the table.
- `proposals` carries `deletedAt` and `moderationDetachedAt` columns, but
  `deleteProposal` hard-deletes. Until that is reconciled, the columns are
  misleading.
