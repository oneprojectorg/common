# 0016. Define Drizzle relations once with the v2 API

Date: 2026-11-11

## Status

Accepted

## Context

Drizzle has two relational query APIs, and the codebase holds both. The v1
`relations()` blocks sit beside each table and serve `db._query`; the v2
`defineRelations` call serves `db.query`. A relation declared in both can
drift, and one declared only in v1 is invisible to new code. This records a
migration that is under way.

In scope: where a relation is declared and which query API new code uses.

## Decision

We will declare every relation in `services/db/relations.ts` with
`defineRelations`, and query through `db.query`.

A new table gets no v1 `relations()` block. New code does not call
`db._query`. A legacy caller moves to `db.query` when next touched, and its
v1 block is deleted once nothing reads it.

## Consequences

- One file answers "how are these tables related".
- `relations.ts` is long (about 1,150 lines) and every schema change that
  adds a relation touches it.
- Until a legacy caller moves, a relation it uses exists in both places and
  a change has to be made twice.
- The two APIs differ in `where` and `orderBy` syntax, so moving a caller is
  a rewrite of the query, not a rename.
