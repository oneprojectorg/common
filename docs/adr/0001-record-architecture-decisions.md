---
status: "proposed"
date: 2026-08-21
decision-makers: Engineering
---

# Record architecture decisions as ADRs

## Context and Problem Statement

The code shows what we chose. It does not show what we rejected, or why.

That reasoning now lives in pull requests and Asana threads. Neither is in the
checkout. So we re-argue settled questions, and we reverse decisions without
seeing the original constraint.

## Decision Drivers

* A reader must find the reasoning in a checkout, with no tool and no login.
* Coding agents must be able to grep it.
* Writing a record must take minutes.
* A record must be immutable. A reversal is a new decision.

## Considered Options

* MADR (Markdown Architectural Decision Records)
* Nygard's five-section ADR
* Y-statements
* Status quo: pull request descriptions and Asana threads

## Decision Outcome

Chosen option: MADR. It is the only option that asks the author for the
considered options and their trade-offs, which is what a future reader needs. It
is plain Markdown in the repository, so it meets the other drivers.

### Consequences

* Good, because the reasoning sits next to the code, under version control.
* Good, because the template forces a rejected option into the record.
* Bad, because a stale record misleads. Superseding is cheap, but someone must do it.
* Bad, because the full template deters a small decision. Delete what you do not need.

### Confirmation

Code review is the check. [README.md](./README.md) defines when an ADR is
warranted.

## Pros and Cons of the Rejected Options

### Nygard's five-section ADR

* Good, because it is short, so authors finish it.
* Bad, because it never asks what else we considered. That omission is the
  failure we want to fix.

### Y-statements

* Good, because one sentence is the cheapest record.
* Bad, because one sentence cannot hold a week of evidence.

### Status quo

* Good, because it costs nothing.
* Bad, because neither a pull request nor an Asana thread is in the checkout.
* Bad, because a pull request covers one diff. A decision can span several.

## More Information

We compared the formats with the ADR org's
[survey](https://adr.github.io/adr-templates/). MADR lives at
<https://github.com/adr/madr>.

### The constitution overlaps this

`.specify/memory/constitution.md` claims to supersede "all other development
practices and guidelines". It encodes rules that are ADR material: the
design-system boundary, the authorization model, and database access patterns.
Three `.specify` workflows read it, `plan-template.md` gates on it, and it has
drifted from practice since 2025-09-26.

This ADR does not reconcile the two. Until the team decides, the constitution
governs the `.specify` workflows and ADRs govern everything else. Raise a real
conflict instead of picking a winner.

### Status

This ADR is `proposed`, because adopting the convention is the team's decision,
not the author's. Approving this pull request makes it. Whoever merges then
flips `status` to `accepted` in a follow-up pull request.

The template and the process work either way. `proposed` withholds one thing:
whether a structural change must have an ADR.
