# 000X. A models layer owns the invariants of a shared table

Date: 2026-09-02

## Status

Proposed

## Context

`@op/db` exports schema only, so every caller writes its own query. `proposals`
appears in 132 non-test files, `profiles` in 88, `profileUsers` in 44. A rule
that belongs to the table — a visibility predicate, the supersession filter, the
sentinel-user exclusion — holds only by convention at each site.

## Decision

We will add `packages/common/src/models/<table>.ts`. A model owns every read and
write of one table, and states its filters and concurrency guards once. Services
compose models, not tables.

A table gets a model when it carries an invariant a caller must not restate.
Other tables keep direct Drizzle access. `moderationFlagStore.ts` is the
reference shape.

## Consequences

A table's filter has one definition, one test, and one place to change.

Two layers now exist where one did. Reviewers must judge whether logic belongs
to the model or the service, and nothing enforces the boundary. Callers migrate
per table, so both paths reach a table until a migration ends.
