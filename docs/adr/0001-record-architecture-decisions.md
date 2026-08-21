---
status: "proposed"
date: 2026-08-21
decision-makers: Engineering
---

# Record architecture decisions as ADRs

## Context and Problem Statement

The code shows what we chose. It does not show what we rejected, or why. That
reasoning lives in pull requests and Asana threads, which are not in the
checkout. So we re-argue settled questions, and we reverse decisions without
seeing the original constraint.

## Considered Options

* MADR (Markdown Architectural Decision Records)
* Nygard's five-section ADR
* Y-statements
* Status quo: pull requests and Asana threads

## Decision Outcome

Chosen option: MADR, because it is the only option that asks the author for the
rejected alternatives. It is plain Markdown, so a reader needs no tool and an
agent can grep it.

We use MADR's minimal template, not its full one. A long template produces long
records, and nobody reads a long record.

### Consequences

* Good, because the reasoning sits next to the code, under version control.
* Bad, because a stale record misleads. Superseding is cheap, but someone must do it.

## More Information

`.specify/memory/constitution.md` claims to supersede "all other development
practices and guidelines", and it covers rules that are ADR material. This ADR
does not reconcile the two. For now the constitution governs the `.specify`
workflows and ADRs govern everything else. The conflict needs its own ADR.

This ADR is `proposed` because adopting the convention is the team's decision,
not the author's. Approving this pull request makes it. Whoever merges then
flips `status` to `accepted`.
