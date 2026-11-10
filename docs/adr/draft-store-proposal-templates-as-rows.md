# NNNN. Store proposal templates as rows

Date: 2026-11-10

## Status

Proposed

## Context

Every proposal in an instance validates and renders against the one
instance template: `instanceData.proposalTemplate`, else
`decisionProcesses.processSchema`. A large process needs the entries for
its voting phase written under a shorter template than the participants'
proposals, in the same instance. One template per instance cannot hold
both.

## Decision

We will store templates as rows in a generic table,
`decision_form_schemas`, scoped to an instance by `process_instance_id`.
A proposal has a nullable `form_schema_id`. Null means the instance
template, as today. The resolver reads the row first, then falls back to
the instance template.

A proposal's form schema is set when the proposal is created and never
changes. Rows are immutable: a change is a new row. This is a convention:
there is no update service and no trigger.

The table name is generic on purpose. Other JSON-schema forms, such as
rubrics and custom forms, can move into it later. We add a `kind` column
only when a second kind moves in. We say "form schema", not "template",
because `templateId` and `templateName` in instance data already mean the
process template.

## Consequences

- Templates have two homes, instance data and rows, until a later
  backfill moves the instance templates into rows.
- `form_schema_id` is outside `proposalColumns`, so proposal history does
  not copy it. It never changes, so history gains nothing from it.
- The foreign key is `ON DELETE RESTRICT`: a schema in use cannot be
  deleted. Deleting the decision still cascades to its proposals and rows.
- Nothing in the database yet stops a proposal from pointing at another
  instance's row. A composite foreign key
  `(process_instance_id, form_schema_id)` comes with the write path. Until
  then, production does not write rows or pointers.
- The other instance-level callers (exports, translation, voting pricing,
  SMS, moderation) keep the instance template until a mixed instance
  reaches them.
- `duplicateInstance` must later copy the rows and remap the pointers.
