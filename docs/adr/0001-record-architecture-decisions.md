---
status: "proposed"
date: 2026-08-21
decision-makers: Engineering
consulted: Engineering
informed: Engineering, Product
---

# Record architecture decisions as ADRs in the repository

## Context and Problem Statement

This monorepo carries many long-lived architecture decisions — Drizzle
relations v2 over v1, one tRPC procedure per file, Base UI under `@op/sense`,
access-zones for authorization. The code shows *what* we chose. It does not
show what else we considered, or which constraint ruled the alternatives out.

Today that reasoning lives in pull request descriptions and Asana threads. Both
are hard to search months later, and neither is visible from the code it
governs. So the same question gets re-litigated, and a decision gets reversed by
someone who never saw the constraint behind it. How do we keep the "why" next to
the code, in a form that survives staff changes?

## Decision Drivers

* The reasoning must be readable from a checkout, with no access to Asana or GitHub.
* It must be greppable by the coding agents that do much of the work in this repo.
* Writing one must cost minutes, not hours, or nobody writes one.
* The record must be immutable — a reversal is a new decision, not an edit.
* Format changes must not need a tool or a service to render them.

## Considered Options

* MADR (Markdown Any Decision Records)
* Nygard's original five-section ADR
* Y-statements
* Status quo — pull request descriptions and Asana threads

## Decision Outcome

Chosen option: "MADR", because it is the only option that prompts the author for
the considered options and their trade-offs. That section is the part a future
reader needs and the part every free-form write-up omits. It is plain markdown in
the repo, so it satisfies the checkout, grep and no-tooling drivers as well.

### Consequences

* Good, because the rationale sits in the repository, versioned with the code it explains.
* Good, because the "Considered Options" prompt makes a rejected alternative
  explicit, which is what stops the decision being re-argued.
* Good, because agents and people read the same file.
* Bad, because a record that nobody updates when reality moves becomes
  misleading. Superseding is cheap, but it has to actually happen.
* Bad, because the full template is long enough to deter a small decision. The
  optional sections exist to be deleted; see the README.
* Neutral, because ADRs duplicate some context that also appears in a PR
  description. The ADR is the durable copy.

### Confirmation

An ADR is warranted for a decision that is costly to reverse and touches more
than one workspace. Code review is the check: a reviewer who cannot tell why a
structural change was made asks for an ADR before approving.

## Pros and Cons of the Options

### MADR

The template published at <https://adr.github.io/adr-templates/>, maintained at
<https://github.com/adr/madr>.

* Good, because it asks for considered options and pros and cons by name.
* Good, because YAML frontmatter carries status and date as data, not prose.
* Good, because it is widely used, so the shape is familiar to new hires.
* Neutral, because the full template has more sections than a small decision
  needs. They are marked optional.

### Nygard's original five-section ADR

Title, Status, Context, Decision, Consequences — from "Documenting Architecture
Decisions" (2011).

* Good, because it is short, and short templates get filled in.
* Good, because it is the format most engineers have seen before.
* Bad, because nothing in it asks what else was considered. In practice the
  rejected options go unrecorded, which is the failure we are trying to fix.

### Y-statements

One sentence: "In the context of X, facing Y, we decided for Z to achieve Q,
accepting D."

* Good, because it is the cheapest possible record.
* Good, because it forces the author to name the trade-off accepted.
* Bad, because one sentence cannot hold the evidence for a decision that took a
  week to reach.
* Neutral, because it works well *inside* another template as a summary line.

### Status quo — pull request descriptions and Asana threads

* Good, because it costs nothing new.
* Bad, because neither is in the checkout, so neither is greppable from the code.
* Bad, because a PR description is scoped to one diff; a decision that spans
  several PRs has no single home.
* Bad, because Asana access is not universal and threads are not versioned.

## More Information

The parent proposal is tracked in Asana as "ADR Proposal". This record is the
first ADR, and its own subject: it uses the template it adopts.

Status is `proposed`, not `accepted` — merging this file is the team's signal to
change it. See [README.md](./README.md) for the process.
