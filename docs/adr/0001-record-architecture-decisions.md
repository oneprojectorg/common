# 1. Record architecture decisions

Date: 2026-08-21

## Status

Proposed

## Context

We make architecture decisions that outlive the pull requests that introduce
them: the ORM query API, the authorization model, the design-system boundary.
The reasoning for each one sits in a pull request description or an Asana
thread. Neither is in the checkout, so nobody can grep it and it is hard to find
later.

A record has to be findable in a checkout, greppable by an agent, and quick to
write. A format that needs tooling to render will not get used.

## Decision

We record architecture decisions in `docs/adr/`, using Nygard's five-section
format: Title, Status, Context, Decision, Consequences. See
[Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions).

## Consequences

The reasoning sits next to the code, under version control, so people and agents
read the same file.

Nothing in the format prompts an author for the alternatives they rejected. Put
those in Context when they matter.

A stale record misleads. Superseding is cheap, but someone has to do it.
