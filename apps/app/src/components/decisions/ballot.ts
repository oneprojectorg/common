import { formatCurrency } from '@/utils/formatting';
import {
  type AmountUnit,
  type Proposal,
  formatUnitAmount,
  getFieldAmount,
  isAtMost,
  sumAmounts,
} from '@op/common/client';

export interface BallotBudget {
  voterBudget: number;
  voterCostField: string;
  unit: AmountUnit;
}

/** Undefined when the phase sets no voter budget, or prices it from no unit. */
export function getBallotBudget({
  voterBudget,
  voterCostField,
  costUnit,
}: {
  voterBudget?: number;
  voterCostField?: string;
  costUnit?: AmountUnit;
}): BallotBudget | undefined {
  if (voterBudget == null || !voterCostField || !costUnit) {
    return undefined;
  }

  return { voterBudget, voterCostField, unit: costUnit };
}

// An unpriceable proposal charges nothing, the same as the server.
export function getProposalCost({
  proposal,
  budget,
}: {
  proposal: Pick<Proposal, 'proposalData'>;
  budget: BallotBudget;
}): number {
  return (
    getFieldAmount({
      value: proposal.proposalData[budget.voterCostField],
      unit: budget.unit,
    }) ?? 0
  );
}

export function getBallotTotal({
  proposals,
  budget,
}: {
  proposals: Array<Pick<Proposal, 'proposalData'>>;
  budget: BallotBudget;
}): number {
  return sumAmounts(
    proposals.map((proposal) => getProposalCost({ proposal, budget })),
  );
}

export function getBallotRemaining({
  proposals,
  budget,
}: {
  proposals: Array<Pick<Proposal, 'proposalData'>>;
  budget: BallotBudget;
}): number {
  return Math.max(
    0,
    sumAmounts([budget.voterBudget, -getBallotTotal({ proposals, budget })]),
  );
}

export function canAffordProposal({
  proposal,
  remaining,
  budget,
}: {
  proposal: Pick<Proposal, 'proposalData'>;
  /** What the ballot has left, from {@link getBallotRemaining}. */
  remaining: number;
  budget: BallotBudget;
}): boolean {
  return isAtMost({
    amount: getProposalCost({ proposal, budget }),
    limit: remaining,
  });
}

/** 1-based position of `id` in the ballot order, or undefined when absent. */
export function getBallotRank({
  ballotIds,
  id,
}: {
  ballotIds: string[];
  id: string;
}): number | undefined {
  const index = ballotIds.indexOf(id);

  return index < 0 ? undefined : index + 1;
}

export function formatBallotAmount({
  amount,
  unit,
}: {
  amount: number;
  unit: AmountUnit;
}): string {
  return unit.kind === 'currency'
    ? formatCurrency(amount, undefined, unit.code)
    : formatUnitAmount({ amount, unit });
}

/** Swaps the item at `index` with its neighbour `offset` places away. */
export function moveBallotItem<T>({
  items,
  index,
  offset,
}: {
  items: T[];
  index: number;
  offset: -1 | 1;
}): T[] {
  const target = index + offset;
  const item = items[index];
  const neighbour = items[target];

  if (item === undefined || neighbour === undefined) {
    return items;
  }

  const moved = [...items];
  moved[index] = neighbour;
  moved[target] = item;

  return moved;
}
