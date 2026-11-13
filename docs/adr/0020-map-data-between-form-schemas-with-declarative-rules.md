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
5. **Use declarative rules with a small expression tree.**

## Decision

We will map data with declarative rules (option 5).

- A mapping rule is data with four parts: a source schema, a target schema, a
  target pointer (JSON Pointer, RFC 6901), and a value expression.
- A value expression is a JSON tree: a pointer into the source data, a
  literal, arithmetic, and a small fixed set of functions. An expression with
  a missing operand gives no value.
- A rule names a schema with `{ type, phaseId }`, where `type` is `proposal`
  or `review`. The caller resolves a reference to a schema. The mapping core
  only compares references.
- The engine evaluates each rule one time for each input that has the source
  schema of the rule. Each result is a candidate, and a candidate keeps the
  ID of its input.
- The engine fills a target field only when all candidates for the field are
  equal. When they are different, the field stays empty and a person chooses.
- The mapping core is in `packages/common/src/schemaMapping/`. It imports no
  decision code and no database code. It has its own expression evaluator.
  The selection pipeline does not change.

## Consequences

- The system can check a rule against the two schemas when the rule is saved.
  It can find all rules that read a field before a template changes.
- A rule can copy a value, and can calculate from the fields of one source,
  for example a total of three cost fields. A rule cannot calculate across
  sources, for example an average of all reviews. That needs a new decision.
- Two expression evaluators exist: this one and the one in the selection
  pipeline. Their expression nodes have the same JSON shape, so a later
  change can join them.
- A mapped value can break a constraint of the target, such as a maximum
  length. The result is a draft. Validation stays at the point where a person
  submits the target.
- `{ type, phaseId }` assumes one schema for each type in a phase. If a phase
  gets more than one, the reference must change to a form schema ID. ADR 0019
  sets that direction.
- **Not decided here:** where the rules are stored.
