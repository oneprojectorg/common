# 1. Record architecture decisions

Date: 2026-08-21

## Status

Proposed. Adopting the convention is the team's decision, not the author's.
Approving this pull request makes it, and whoever merges then sets Status to
Accepted.

## Context

The code shows what we chose. It does not show what we rejected, or why. That
reasoning lives in pull requests and Asana threads, which are not in the
checkout. So we re-argue settled questions, and we reverse decisions without
seeing the original constraint.

A record has to be findable in a checkout, greppable by an agent, and quick to
write. A format that needs tooling to render, or that runs to several pages,
will not get used.

`.specify/memory/constitution.md` already claims to supersede "all other
development practices and guidelines", and it covers rules that are ADR
material.

## Decision

We record architecture decisions in `docs/adr/`, using Nygard's five-section
format: Title, Status, Context, Decision, Consequences. See
[Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

We keep it to five sections. A longer template produces longer records, and
nobody reads a long record.

We do not reconcile this with the constitution here. For now the constitution
governs the `.specify` workflows and ADRs govern everything else. That conflict
needs its own ADR.

## Consequences

The reasoning sits next to the code, under version control, so people and agents
read the same file.

Nothing in the format prompts an author for the alternatives they rejected. Put
those in Context when they matter.

A stale record misleads. Superseding is cheap, but someone has to do it.
