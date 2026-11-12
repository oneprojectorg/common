# 0020. Decide phase transitions with a selection pipeline over aggregated facts

Date: 2026-11-12

## Status

Proposed

## Context

When an instance leaves a phase, `advancePhase` runs that phase's
`selectionPipeline`, a JSON list of blocks, over the phase's proposals. The
output becomes proposals available to the next phase. Different processes select differently: all
proposals, the top N, or ranked-choice winners that fit a budget, etc. We need one
rule for where such calculations live, and a default for a phase with no
pipeline.

## Decision

The service supplies facts. The pipeline holds the policy.

The service builds the pipeline's context once per transition:

- `proposals`: the departing phase's proposals.
- `voteData`: per proposal, from `aggregateProposalMetrics`: vote, approval,
  like and follow counts, and `rankCounts` (selections per rank). No scores.
- `variables`: the departing phase's settings, such as `budget`. A variable
  that the pipeline defines overrides a setting with the same name.

Blocks read only that context and never query the database. A field
expression reads `proposalData.*` from the proposal and `voteData.*` from the
proposal's metrics.

A phase with no `selectionPipeline` advances no proposals. An admin selects
them by hand. An empty pipeline advances all proposals. This is how
`advancePhase` works today, and it does not change.

Each calculation is a block in the phase's selection pipeline:

- Ranked-choice points: a `score` block weights `rankCounts` 1 to 4 by 5, 4,
  3 and 2, and every lower rank by 1. A `sort` block orders by points, then
  `voteCount`, then `createdAt`.
- Budget: a `budget` block walks proposals in order and accepts each one
  whose cost fits the remaining budget. It skips the others.

The service stores each proposal's outcome per transition: selected or
skipped, position, scores, cost and remaining budget. An admin can still
advance a skipped proposal by hand.

## Consequences

- A new voting method is template JSON. A new fact is one change to the
  aggregator.
- Results show the stored outcome, so later vote changes do not alter it.
- A phase that must advance proposals without an admin needs a pipeline.
- Schema validation checks a pipeline's shape, not its meaning. A wrong
  formula selects the wrong set without an error.
- A proposal with no cost counts as 0, so the `budget` block always accepts
  it.
