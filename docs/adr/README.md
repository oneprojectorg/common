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
code. A decision that shapes one package for years qualifies; it does not have
to span workspaces. Examples: an ORM query API, the authorization model, a
data-migration strategy.

Skip it for a decision the code explains, a cheap choice, or a bug fix. Ask in
review when you are unsure.

## How to write one

1. Copy [`adr-template.md`](./adr-template.md) to `NNNN-short-title.md`, with
   the next free number, and put the same number in the `# NNNN.` heading.
2. Open a pull request. Review of the ADR is the decision meeting.
3. Merge. Nothing renumbers the file afterwards.

The **ADR numbers** check (`scripts/check-adr-numbers.sh`) fails the pull
request when a new ADR does not take the next free number on the base branch.
If another ADR merges first and takes yours, merge the base branch, rename the
file, and fix its heading and any link to it.

Write the title as a statement: "Use Drizzle relations v2 for new tables", not
"Drizzle relations". Never reuse a number, and never renumber a merged ADR.

## Status

| Status | Meaning |
| --- | --- |
| `Proposed` | Open for discussion. Not in force. |
| `Accepted` | In force. |
| `Rejected` | Declined. Kept so nobody reopens the question blind. |
| `Deprecated` | No longer relevant. Nothing replaced it. |
| `Superseded by ADR-NNNN` | Replaced. Points at the replacement. |

Set Accepted when the ADR merges. Use Proposed only to get discussion without
commitment; whoever merges it then sets Accepted.

## Superseding a decision

A reversal is a new ADR, not an edit. In the same pull request, set the old
one's Status to `Superseded by ADR-NNNN` and link forward.

Never rewrite the reasoning in a superseded ADR. Fix a typo, but do not change
what it decided.
