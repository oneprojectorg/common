# 0020. Map data between form schemas with declarative rules

Date: 2026-11-13

## Status

Accepted

## Context

A decision process can develop one new proposal from existing proposals and
from the reviews of those proposals. The new proposal must start with data
from those sources. Each source and the target is a pair of a JSON Schema and
data.

These facts limit the solution:

- **Admins define the schemas.** Custom fields have generated keys, and an
  admin can remove or replace any field. Two schemas do not share field names
  in a reliable way, so the system cannot link fields by name.
- **One target can have many sources.** Two sources of the same schema can
  give different values for the same target field.

We considered five options.

1. **Match fields by key.** This works only for fields that keep a fixed key.
   Custom fields do not.
2. **Write code for each target.** An admin cannot change it, and it puts the
   logic of one process in the backend.
3. **Use a general transformation language, such as JSONata.** The
   transformation is a program in a string. The system cannot check it
   against the two schemas when it is saved, and cannot find which
   transformations read a given field.
4. **Use the blocks of the selection pipeline.** A block takes a list of
   items and returns a list of the same items. No block builds one new record
   from sources of different types.
5. **Use declarative rules whose values are expressions of the selection
   pipeline.**

## Decision

We will map data with declarative rules (option 5), and evaluate them with the
expression evaluator of the selection pipeline.

- A mapping rule is data with four parts: a source schema, a target schema, a
  target field (a dot path, for example `budget.amount`), and a value
  expression.
- A value expression is the selection pipeline's `Expression` tree. A `field`
  node reads the source data with a dot path. The mapping accepts the
  evaluator's literal, field, comparison, logical, arithmetic and function
  nodes. It rejects `variable` nodes and function names that the evaluator
  does not know.
- The mapping calls the existing evaluator and does not change it. The
  evaluator's context type requires a proposal database row, so the mapping
  puts the source data in the `proposalData` column of a placeholder row and
  adds the `proposalData.` prefix to each `field` node of a copy of the rule.
  No rule can read a column of the placeholder row.
- A rule names a schema with `{ type, phaseId }`, where `type` is `proposal`
  or `review`. The caller resolves a reference to a schema. The mapping core
  only compares references.
- The engine evaluates each rule one time for each input that has the source
  schema of the rule. Each result is a candidate, and a candidate keeps the
  ID of its input.
- A rule gives no candidate when a field it reads is missing, `null` or
  empty, when a divisor is 0, or when the result is empty or not a finite
  number. A direct argument of `coalesce` can be missing.
- The engine fills a target field only when all candidates for the field are
  equal. When they are different, the field stays empty and a person chooses.
- The mapping core is in `packages/common/src/schemaMapping/`. It imports the
  selection pipeline's evaluator and types, and no other decision code or
  database code.

## Consequences

- The system can check a rule against the two schemas when the rule is saved.
  It can find all rules that read a field before a template changes.
- A rule can copy a value, and can calculate from the fields of one source,
  for example a total of three cost fields. A rule cannot calculate across
  sources, for example an average of all reviews. That needs a new decision.
- One expression language serves the selection pipeline and the mapping.
- A dot path cannot address a key that contains a dot.
- The evaluator reads a missing or non-number operand as 0, and gives 0 for a
  division by 0. The mapping must not pre-fill a wrong number, so it adds its
  own checks for missing values and zero divisors before it calls the
  evaluator. A change to the evaluator can make these checks incomplete.
- The mapping depends on an evaluator that has no direct unit tests. The
  mapping's tests are the only tests of its behaviour.
- The placeholder proposal row exists only because of the evaluator's
  parameter type. A later change that lets the evaluator take plain data
  removes it.
- A mapped value can break a constraint of the target, such as a maximum
  length. The result is a draft. Validation stays at the point where a person
  submits the target.
- `{ type, phaseId }` assumes one schema for each type in a phase. If a phase
  gets more than one, the reference must change to a form schema ID. ADR 0019
  sets that direction.
- **Not decided here:** where the rules are stored.
