# Draft. Store ballot constraints as voting-phase rules and rank on the vote-proposal row

Date: 2026-09-21

## Status

Accepted

## Context

A ballot was capped one way prior, by a vote count stored in the voting phase's
rules. We need two more constraints, possibly together on one phase: a
per-voter budget, where each proposal costs its own budget, and a ranked
ballot.

In scope: where the rules live, how a ballot is validated against them, and
where rank is stored. Out of scope: tallying, results, and the selection
pipeline.

## Decision

- Both constraints are voting-phase rules, next to the existing count cap, not
  entries in the legacy schema registry. The budget rule stores only a number;
  its unit is the template's budget unit (see
  [the budget-unit ADR](./draft-declare-budget-units-on-the-template.md)).
- The count cap and the budget cap are independent. Either may be unset and
  both may apply.
- A proposal whose cost is missing, unparseable, or in a unit that disagrees
  with the template costs 0 and stays selectable. A misconfigured budget field
  must not make a proposal unvotable.
- Ranked and budget compose as "pick within budget, then order". Budget
  validation ignores rank, and rank is written only on a ballot that passed
  every other check.
- Rank is a nullable column on the vote-proposal row, unique per submission
  in the database, so the ordering invariant holds under concurrency. Null
  means an unranked ballot.
- The enforced budget, its unit, the per-selection costs, and the total are
  snapshotted onto the submission as optional keys.

## Consequences

- Rules are written wholesale, so omitting a key clears it. That is the
  "turn the cap off" path.
- Tally code can adopt rank and the cost snapshot later, because both are
  additive.
- A budget rule on a phase whose template no longer collects a budget is
  stripped on write, and every cost resolves to 0 regardless.
- Changing the template's unit after ballots exist reinterprets the budget
  rule. The snapshot keeps the history readable.
