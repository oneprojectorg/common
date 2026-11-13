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
2. Add its line to the end of the [index](#index): the heading, linked to the
   file.
3. Open a pull request. Review of the ADR is the decision meeting.
4. Merge. Nothing renumbers the file afterwards.

The **ADR numbers** check (`scripts/check-adr-numbers.sh [<base-ref>]`) fails
the pull request when a new ADR does not take the next free number on the base
branch, or when the index does not list every ADR.

If another ADR merges first, git reports a conflict in the index and your pull
request cannot merge. Merge the base branch, keep both lines, then give your
ADR the next free number: rename the file and fix its heading, its index line
and any link to it.

Write the title as a statement: "Use Drizzle relations v2 for new tables", not
"Drizzle relations". Never reuse a number, and never renumber a merged ADR.
Reference an ADR by its number only once it has merged; until then, link the
pull request.

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

## Index

- [0001. Record architecture decisions](./0001-record-architecture-decisions.md)
- [0002. Notification participants include members, submitters, and invited collaborators](./0002-process-participant-for-notifications.md)
- [0003. Return every list as `{ items, next }` from one schema factory](./0003-return-every-list-as-items-next.md)
- [0004. Support Multi Modal Notifications](./0004-support-multi-modal-notifications.md)
- [0005. Key feature messages by ID inside namespaces](./0005-key-feature-messages-by-id-inside-namespaces.md)
- [0006. Store ballot constraints as voting-phase rules and rank on the vote-proposal row](./0006-store-ballot-constraints-as-phase-rules.md)
- [0007. Bind a phone number to each decision](./0007-bind-a-phone-number-to-each-decision.md)
- [0008. Enrol a voter before the first vote](./0008-enrol-a-voter-before-the-first-vote.md)
- [0009. Keep the draft ballot in its own table](./0009-keep-the-draft-ballot-in-its-own-table.md)
- [0010. Store a short code on each proposal](./0010-store-a-short-code-on-each-proposal.md)
- [0011. Keep routers thin and put business logic in the service layer](./0011-keep-routers-thin-and-put-logic-in-the-service-layer.md)
- [0012. Authenticate at the boundary and pass a verified identity inward](./0012-authenticate-at-the-boundary.md)
- [0013. Authorize in the service layer with access-zones](./0013-authorize-in-the-service-layer-with-access-zones.md)
- [0014. Use realtime to invalidate queries, not to carry data](./0014-use-realtime-to-invalidate-queries-not-to-carry-data.md)
- [0015. Run background work as typed events handled by workflows](./0015-run-background-work-as-typed-events-handled-by-workflows.md)
- [0016. Define Drizzle relations once with the v2 API](./0016-define-drizzle-relations-once-with-the-v2-api.md)
- [0017. Fetch client data with suspense queries inside error boundaries](./0017-fetch-client-data-with-suspense-queries-inside-error-boundaries.md)
- [0018. Log through `@op/logging`, never the console](./0018-log-through-op-logging-never-the-console.md)
- [0019. Record the template a proposal is written under](./0019-record-the-template-a-proposal-is-written-under.md)
- [0020. Map data between form schemas with declarative rules](./0020-map-data-between-form-schemas-with-declarative-rules.md)
