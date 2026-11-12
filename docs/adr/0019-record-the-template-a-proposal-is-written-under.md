# 0019. Record the template a proposal is written under

Date: 2026-11-10

## Status

Accepted

## Context

A decision process collects proposals through a template. Today every
proposal in an instance uses one template. The system finds that template
when it reads the proposal.

We need to support these cases:

- **Different templates in different phases.** A later phase can need a
  template that is different from the template used to submit.
- **More than one template in one phase.** We do not support this yet, but
  this decision must not prevent it.
- **Template changes after submission.** Admins edit a template after
  participants have submitted proposals with it.
- **Reads in a different context.** A proposal that was written in one
  phase is read in later phases, in exports and on the voting screen.

We considered three options.

1. **Find the template when the proposal is read** (the current model). The
   reader picks a template from the context, such as the instance or the
   phase. With more than one template, it is not clear which template a
   proposal belongs to, and the reader must use a heuristic such as dates.
   Proposals that resolve to the same template can also have different
   shapes. For example, a proposal written before an admin added a required
   "budget" field has no budget, and nothing shows which proposals were
   written before the change.
2. **Show one proposal through a different template in each phase.** A
   template for a later phase is then a view of the proposal. This works
   only if the later template adds no content. A view can show content that
   exists, but it cannot hold new content, such as a new required field.
3. **Record the template when the proposal is written.** Each proposal
   stores a reference to the template it was written under.

## Decision

We will record the template when the proposal is written (option 3).

- A proposal records the template it was written under, when it is written.
- Validation and rendering find the template for each proposal.
- The reference changes only through an explicit step that validates the
  proposal against the new template. This ADR does not decide what that
  step is: an update to the same proposal, or a new proposal created from
  it.

## Consequences

- An instance or a phase can have more than one template without a change
  to this rule.
- Proposals that point at the same template are valid under the same
  schema.
- The system can find all proposals that a template edit affects. Then it
  can block an edit that can make them invalid, or require a new template
  for that edit. Which edits are compatible is not decided here.
- Readers that find one template for the instance today must change to find
  the template for each proposal. An instance has few templates, so the
  cost is small.
- In the future, a view (a card, an export, a resident page) can have its
  own schema. The template that a proposal was written under is then the
  **writer's schema**, and the schema of the view is the **reader's
  schema**.
- **Not decided here:** where templates are stored, template versions, how
  a new proposal gets data from its origin, and permissions for each field.

See also: AT Protocol Lexicon, where each record carries `$type`, the schema
it was written under. Kleppmann, _Designing Data-Intensive Applications_,
ch. 4, for writer's and reader's schemas. Ink & Switch,
["Project Cambria"](https://www.inkandswitch.com/cambria/), for mappings
between schemas.
