# Architecture Decision Records

An ADR records one architecture decision: the problem, the options we weighed,
what we chose, and what we accepted in return. It captures the reasoning that
the code itself cannot show.

The format is [MADR](https://adr.github.io/adr-templates/). See
[ADR 0001](./0001-record-architecture-decisions.md) for why.

## When to write one

Write an ADR when a decision is **costly to reverse** and **crosses a workspace
boundary**. Examples: choosing an ORM query API, the authorization model, how
the design system wraps a third-party primitive, a data-migration strategy.

Do not write one for a decision that the code already explains, a choice that is
cheap to change later, or a bug fix. A PR description is the right home for
those.

If you are unsure, ask in review. A reviewer who cannot tell why a structural
change was made will ask for an ADR.

## How to write one

1. Copy [`adr-template.md`](./adr-template.md) to
   `docs/adr/NNNN-short-title-in-kebab-case.md`.
2. Take the next free `NNNN` — four digits, zero-padded, sequential. Never reuse
   a number, even for an ADR that was rejected.
3. Fill in the frontmatter and the required sections. Delete every optional
   section you do not need — they are marked with an HTML comment.
4. Open it as a normal pull request. Review of the ADR *is* the decision
   meeting.

Keep the title a statement, not a topic: "Use Drizzle relations v2 for new
tables", not "Drizzle relations".

## Status lifecycle

Set `status` in the frontmatter to exactly one of:

| Status | Meaning |
| --- | --- |
| `proposed` | Open for discussion. The decision is not yet in force. |
| `accepted` | In force. New code is expected to follow it. |
| `rejected` | Considered and declined. Kept so the question is not reopened blind. |
| `deprecated` | No longer relevant, and nothing replaced it. |
| `superseded by ADR-NNNN` | Replaced. Point at the ADR that replaced it. |

Merging an ADR that is `proposed` is the signal to move it to `accepted`.

## Superseding a decision

**Never rewrite the reasoning in an accepted ADR.** The record of what we
believed at the time is the point of the exercise.

To reverse a decision:

1. Write a new ADR that states the new decision and why the old one no longer
   holds. Reference the old number.
2. In the old ADR, change only `status` to `superseded by ADR-NNNN`, and add the
   link under "More Information".

Correcting a typo or a broken link in an accepted ADR is fine. Changing what it
decided is not.
