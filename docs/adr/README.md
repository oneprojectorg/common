# Architecture Decision Records

An ADR records one architecture decision: the problem, the options we weighed,
what we chose, and what we accepted in return. It captures the reasoning that
the code itself cannot show.

The format is [MADR](https://adr.github.io/adr-templates/). See
[ADR 0001](./0001-record-architecture-decisions.md) for why.

[`adr-template.md`](./adr-template.md) is upstream MADR with one local change:
the frontmatter marks `status` and `date` as required and lists only the five
statuses below, because the lifecycle here depends on both. Keep that change if
you re-sync the template from upstream.

## When to write one

Write an ADR when a decision is **costly to reverse** and **hard to infer from
the code** — when a reader could see what we did but not what else we weighed.
It does not have to span workspaces; a decision that shapes one package for
years qualifies. Examples: choosing an ORM query API, the authorization model,
how the design system wraps a third-party primitive, a data-migration strategy.

Do not write one for a decision that the code already explains, a choice that is
cheap to change later, or a bug fix. A PR description is the right home for
those.

If you are unsure, ask in review. A reviewer who cannot tell why a structural
change was made will ask for an ADR.

This section is the single definition of that threshold. Elsewhere — in
`CONTRIBUTING.md`, `CLAUDE.md`, or an ADR — link here rather than restate it, so
there is only one place to edit when it changes.

## How to write one

1. Copy [`adr-template.md`](./adr-template.md) to
   `docs/adr/NNNN-short-title-in-kebab-case.md`.
2. Take the next free `NNNN` — four digits, zero-padded, sequential. Never reuse
   a number, even for an ADR that was rejected. Two branches can claim the same
   number without git noticing, because the filenames differ by slug — so if
   another open PR already claimed yours, renumber before merging.
3. Fill in the frontmatter and the required sections. Delete every optional
   section you do not need — they are marked with an HTML comment.
4. Open it as a normal pull request. Review of the ADR *is* the decision
   meeting.

Keep the title a statement, not a topic: "Use Drizzle relations v2 for new
tables", not "Drizzle relations".

## Status lifecycle

`status` is one of these five. If you need one that is not here, add it to this
table and to the template in the same PR, and say why:

| Status | Meaning |
| --- | --- |
| `proposed` | Open for discussion. The decision is not yet in force. |
| `accepted` | In force. New code is expected to follow it. |
| `rejected` | Considered and declined. Kept so the question is not reopened blind. |
| `deprecated` | No longer relevant, and nothing replaced it. |
| `superseded by ADR-NNNN` | Replaced. Point at the ADR that replaced it. |

Most ADRs should be `accepted` when they merge — approving the PR *is* the
decision. Open one as `proposed` only when you want the discussion without the
commitment; whoever merges it is then responsible for flipping it to `accepted`
in a follow-up commit, or the decision silently never takes effect.

## Superseding a decision

A reversal is a new ADR, not an edit. Write one that states the new decision and
why the old one no longer holds, then in the old ADR set `status` to
`superseded by ADR-NNNN`, bump `date`, and link forward under "More
Information".

**Do not rewrite the reasoning in a superseded ADR.** The record of what we
believed at the time is the point of the exercise. Fixing a typo or a dead link
is fine; changing what it decided is not.
