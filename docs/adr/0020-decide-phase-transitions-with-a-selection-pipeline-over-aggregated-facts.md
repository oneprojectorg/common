# 0020. Decide phase transitions with a selection pipeline over aggregated facts

Date: 2026-11-12

## Status

Proposed

## Context

A decision process moves proposals from phase to phase, and which proposals
advance depends on the process: all of them, a shortlist by likes, the top N,
or the ranked-choice winners that fit a budget. Each phase in a process schema
can carry a `selectionPipeline`, a JSON list of blocks that `advancePhase`
runs over the departing phase's proposals when the instance moves on. The
output set becomes the next phase's membership in
`decision_transition_proposals`. Today a phase without a pipeline advances
nothing, an empty pipeline advances everything, and an admin can also select
by hand.

Votes are stored as selections: one `decisions_vote_submissions` row per
voter and one `decisions_vote_proposals` row per chosen proposal, with `rank`
on a ranked phase (ADR 0006). Likes and follows are profile relationships. A
proposal's cost is a template field, read from the live document in the voter
cost field's unit.

Two questions recur: where a calculation such as ranked-choice points belongs,
and what the pipeline may see. In scope: the boundary between the service that
runs a transition and the pipeline that decides it, and how the decision is
kept.

## Decision

We will keep the service as the supplier of facts and the pipeline as the
holder of policy.

The service builds the pipeline's context once per transition, in
`advancePhase`:

- `proposals`: the departing phase's proposals, from `getProposalsForPhase`.
- `voteData`: one record per proposal from `aggregateProposalMetrics`:
  `voteCount`, the approval counts and rate, `likesCount`, `followsCount`,
  `rankCounts` (how many selections ranked the proposal 1st, 2nd, 3rd and so
  on, keyed by rank) and the raw submission data. The aggregator derives no
  score.
- `variables`: the departing phase's settings, such as `budget` and
  `maxVotesPerMember`. A setting wins over a default in the pipeline's own
  `variables`.
- `proposalCosts`: the proposals priced the way ballots are priced, by
  `getProposalCosts` from the live document in the template's unit. The
  service resolves them before the advancing transaction, and only when the
  pipeline has a `budget` block.

A phase that does not define a `selectionPipeline` uses the default
pipeline, which has no blocks and so passes every proposal of the departing
phase. An empty pipeline does the same. A phase that must advance a subset,
or nothing, defines a pipeline that says so. The last phase needs no
pipeline, because no transition leaves it.

The pipeline decides with blocks over that context and nothing else:
`filter`, `transform`, `compute`, `branch`, `merge`, `group`, `limit`,
`sort`, `score`, `budget` and `debug`. A field expression reads
`proposalData.*` from the proposal and `voteData.*` from that proposal's
record. A block never queries the database.

Every calculation that is policy lives in the template as blocks:

- Ranked-choice points: a `score` block weights `voteData.rankCounts.1` to
  `voteData.rankCounts.4` by 5, 4, 3 and 2, and the remaining selections
  (`voteCount` minus those four) by 1, into `metadata.rankPoints`. A `sort`
  block orders by that field, then by `voteCount`, then by `createdAt`
  ascending, so the earlier submission wins a tie.
- Budget: a `budget` block walks the proposals in their current order,
  accepts a proposal when its cost fits the budget that is left, and skips it
  otherwise. An unpriced proposal costs nothing, as on a ballot. An invalid
  amount stops the transition. The template owns the order the walk sees: a
  tie left after its last sort key keeps the input order, newest proposal
  first, so a template that walks a budget ends its sort with a key that
  cannot tie.

The service persists what the pipeline decided, per proposal per transition:
`selected` or `skipped`, the position in the walk, the scores the pipeline
wrote, the cost and the budget that was left. Membership stays in
`decision_transition_proposals`, so an admin can still advance a skipped
proposal by hand.

## Consequences

- A phase without a pipeline advances all its proposals, not none. A template
  author who forgets the pipeline loses no proposals, and an admin can still
  remove proposals by hand. `advancePhase` changes its default from pass-none
  to pass-all; existing phases without a pipeline change behaviour at their
  next transition.
- A new voting method is template JSON, not code, as long as the facts it
  needs are in `voteData`. A new fact is one addition to the aggregator.
- The 5-4-3-2-1 ladder is one template's weights. Another template can use
  other weights with no code change.
- The results screen shows what the count did without running it again, and
  a selection changed later does not change the record.
- Pricing runs outside the transaction, so a proposal that arrives after
  pricing makes the transition fail and retry rather than advance unpriced.
- A pipeline is JSON that a template author writes. A wrong formula selects
  the wrong set with no type error, because schema validation checks shape,
  not meaning.
- A phase that selects by budget needs a priced cost field on its template,
  or the transition fails.
