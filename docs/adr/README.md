# Architecture Decision Records

An ADR records one architecture decision: the problem, the choice, and the cost.
Keep it to one page.

We use Nygard's five-section format — Title, Status, Context, Decision,
Consequences — from
[Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).
[ADR 0001](./0001-record-architecture-decisions.md) says why.
[`adr-template.md`](./adr-template.md) is the template.

## When to write one

Write an ADR when a decision is costly to reverse and hard to infer from the
code. It does not have to span workspaces: a decision that shapes one package
for years qualifies. Examples: an ORM query API, the authorization model, a
data-migration strategy.

Skip it for a decision the code explains, a cheap choice, or a bug fix. Ask in
review when you are unsure. This section is the only definition of the
threshold: link here instead of restating it.

## How to write one

1. Copy [`adr-template.md`](./adr-template.md) to `NNNN-short-title.md`.
2. Take the next free `NNNN`. Use four digits, and never reuse a number.
3. Open a pull request. Review of the ADR is the decision meeting.

Title the file and the heading with the same words, and write the title as a
statement: "Use Drizzle relations v2 for new tables", not "Drizzle relations".

Two branches can take one number without a git conflict, because the slugs
differ. Renumber before you merge if another pull request took yours.

## Status

The Status section holds one of these five values:

| Status | Meaning |
| --- | --- |
| `Proposed` | Open for discussion. Not in force. |
| `Accepted` | In force. |
| `Rejected` | Declined. Kept so nobody reopens the question blind. |
| `Deprecated` | No longer relevant. Nothing replaced it. |
| `Superseded by ADR-NNNN` | Replaced. Points at the replacement. |

Most ADRs are Accepted when they merge, because approval is the decision. Use
Proposed to get discussion without commitment. Whoever merges it then sets it to
Accepted in a follow-up pull request.

## Superseding a decision

A reversal is a new ADR, not an edit. Write one that states the new decision and
why the old one failed. Then set the old ADR's Status to
`Superseded by ADR-NNNN` and link forward.

Never rewrite the reasoning in a superseded ADR. Fix a typo, but do not change
what it decided.
