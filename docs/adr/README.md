# Architecture Decision Records

An ADR records one architecture decision: the problem, the options, the choice,
and the cost. We use [MADR](https://adr.github.io/madr/), for the reasons in
[ADR 0001](./0001-record-architecture-decisions.md).

[`adr-template.md`](./adr-template.md) is the
[upstream template](https://github.com/adr/madr/blob/develop/template/adr-template.md)
with one change: the frontmatter requires `status` and `date`, and lists only the
five statuses below. Keep that when you re-sync.

## When to write one

Write an ADR when a decision is costly to reverse and hard to infer from the
code. It does not have to span workspaces: a decision that shapes one package
for years qualifies.

Examples: an ORM query API, the authorization model, how the design system wraps
a third-party primitive, a data-migration strategy.

Skip the ADR for a decision the code explains, a cheap choice, or a bug fix. Ask
in review when you are unsure. This section is the only definition of the
threshold: link here instead of restating it.

## How to write one

1. Copy [`adr-template.md`](./adr-template.md) to `NNNN-short-title.md`.
2. Take the next free `NNNN`. Use four digits, and never reuse a number.
3. Fill in the frontmatter. Delete the optional sections you do not need.
4. Open a pull request. Review of the ADR is the decision meeting.

Write the title as a statement: "Use Drizzle relations v2 for new tables", not
"Drizzle relations".

Two branches can take one number without a git conflict, because the slugs
differ. Renumber before you merge if another pull request took yours.

## Status

| Status | Meaning |
| --- | --- |
| `proposed` | Open for discussion. Not in force. |
| `accepted` | In force. |
| `rejected` | Declined. Kept so nobody reopens the question blind. |
| `deprecated` | No longer relevant. Nothing replaced it. |
| `superseded by ADR-NNNN` | Replaced. Points at the replacement. |

Most ADRs are `accepted` when they merge, because approval is the decision. Use
`proposed` to get discussion without commitment. Whoever merges it then flips it
to `accepted` in a follow-up pull request.

## Superseding a decision

A reversal is a new ADR, not an edit. Write one that states the new decision and
why the old one failed. Then set the old ADR's `status` to
`superseded by ADR-NNNN`, bump its `date`, and link forward.

Never rewrite the reasoning in a superseded ADR. The record of what we believed
is the point. Fix a typo, but do not change what it decided.
