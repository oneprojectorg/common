/**
 * Knapsack voting arithmetic: what a proposal costs a voter, and whether a
 * selection still fits the per-voter budget (ADR 0006).
 *
 * Every sum and comparison happens in fixed point, so a ballot that exactly
 * meets its budget is never rejected by float drift. Shared with the client
 * so the two sides agree on which selections are affordable.
 */
import {
  type AmountUnit,
  resolveUnitAmount,
  toFixedPointUnits,
} from './budgetUnit';
import type { BudgetData } from './proposalDataSchema';

/** Budgets by proposal id, as `resolveProposalBudgets` returns them. */
export type ProposalCosts = ReadonlyMap<string, BudgetData | null>;

/**
 * What one proposal costs, in `unit`.
 *
 * A budget that is missing, unparseable, or stored in another unit costs
 * nothing and stays selectable — a misconfigured budget field must not make a
 * proposal unvotable.
 */
export function getProposalCost(
  budget: BudgetData | null | undefined,
  unit: AmountUnit,
): number {
  const resolved = resolveUnitAmount(budget, unit);

  return resolved ? resolved.amount : 0;
}

/** What a whole selection costs, in `unit`. */
export function sumSelectedCost(
  selectedIds: readonly string[],
  costs: ProposalCosts,
  unit: AmountUnit,
): number {
  const total = selectedIds.reduce(
    (sum, id) => sum + toFixedPointUnits(getProposalCost(costs.get(id), unit)),
    0,
  );

  return total / 100;
}

/**
 * Whether adding `proposalId` to `selectedIds` still fits `voterBudget`.
 *
 * Already-selected ids are counted once, so re-asking about a selected
 * proposal answers "does it still fit" rather than "can I afford it twice".
 */
export function canAffordProposal(
  proposalId: string,
  selectedIds: readonly string[],
  costs: ProposalCosts,
  unit: AmountUnit,
  voterBudget: number,
): boolean {
  const withProposal = selectedIds.includes(proposalId)
    ? selectedIds
    : [...selectedIds, proposalId];

  return (
    toFixedPointUnits(sumSelectedCost(withProposal, costs, unit)) <=
    toFixedPointUnits(voterBudget)
  );
}
