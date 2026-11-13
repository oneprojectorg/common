# 0021. Map data between form schemas with declarative rules

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

We will map data with declarative rules (option 5). The rules start as a
direct copy of one source field to one target field. The engine reads the
source field with the expression evaluator of the selection pipeline. Other
value expressions of the selection pipeline are the planned next step.

- A mapping is data with three parts: a source schema (`from`), a target
  schema (`to`), and a list of fields. Each field copies one source field
  (`from`) to one target field (`to`). There is one mapping for each pair of
  schemas:

  ```ts
  {
    from: { type: 'proposal', phaseId: 'submission' },
    to: { type: 'proposal', phaseId: 'ballot' },
    fields: [
      { from: 'title', to: 'summary' },
      { from: 'cost.amount', to: 'budget' },
    ],
  }
  ```

- The source field is a dot path into the source data, for example
  `cost.amount`. The target field is one key of the target data. It cannot
  contain a dot. Nested target paths are deferred.
- For each copied field, the first version evaluates one `field` node with
  the expression evaluator of the selection pipeline
  ([0020](./0020-decide-phase-transitions-with-a-selection-pipeline-over-aggregated-facts.md)).
- The evaluator reads a field from one generic `record` and does not name a
  proposal. The mapping passes the source data as the record. The pipeline
  passes the proposal row, or its own context for a block that evaluates
  once, so its behaviour does not change.
- Before it calls the evaluator, the mapping reads the source field as an own
  property. The evaluator reads inherited properties and gives `null` for a
  missing field, so this check stops a mapping from reading, for example,
  `toString`.
- The next step lets a field use a value expression of the selection
  pipeline, for example `add`, in place of a source path. We will add the
  operators one at a time.
- A mapping names a schema with `{ type, phaseId }`, where `type` is
  `proposal` or `review`. The caller resolves a reference to a schema. The
  mapping core only compares references.
- The engine reads each field of a mapping one time for each input that has
  the source schema of the mapping.
- A field gives no value for an input when the source field is missing,
  `null` or empty.
- The engine fills a target field only when all values for the field are
  equal. When inputs give different values, the field stays empty and a
  person fills it.
- The mapping core is in `packages/common/src/schemaMapping/`. It imports
  the expression evaluator of the selection pipeline and no database code.

## Consequences

- Because rules are data, the system can check a rule against the two
  schemas and find all rules that read a field before a template changes.
  This check is deferred until rules are stored and edited.
- A rule can only copy a value. It cannot write a literal or calculate a
  value, for example a total of three cost fields. These need value
  expressions. A rule that calculates across sources, for example an average
  of all reviews, needs a new decision.
- When value expressions are added, one expression language serves the
  selection pipeline and the mapping.
- A dot path cannot address a key that contains a dot.
- A rule cannot write into a nested object of the target, for example only
  the amount of a money field. It must copy the full object.
- When value expressions are added, these facts need a solution:
  - The evaluator reads a missing or non-number operand as 0. The mapping
    must not pre-fill a wrong number, so it must check for missing values
    before it calls the evaluator. Each operator or function that is added
    needs the same review, for example a zero divisor if `divide` is allowed.
  - The evaluator has no direct unit tests. The tests of the mapping cover
    the field access that it uses. Each operator that is added needs tests
    through the mapping.
- A mapped value can break a constraint of the target, such as a maximum
  length. The result is a draft. Validation stays at the point where a person
  submits the target.
- `{ type, phaseId }` assumes one schema for each type in a phase. If a phase
  gets more than one, the reference must change to a form schema ID. ADR 0019
  sets that direction.
- The result is only the mapped data. Returning the conflicting values with
  the input each came from is deferred until a screen needs it.
- **Not decided here:** where the rules are stored.
