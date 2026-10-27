'use client';

import {
  type MoneyAmount,
  type Proposal,
  type ProposalAllocation,
  proposalAllocationSchema,
  sumAmounts,
} from '@op/common/client';
import { useCallback, useMemo, useRef, useState } from 'react';

import { getBudgetCurrency } from './BudgetDisplay';
import { resolveProposalSystemFields } from './proposalContentUtils';

export type AwardProposal = Pick<
  Proposal,
  'id' | 'proposalData' | 'proposalTemplate' | 'documentContent'
>;

export type AwardEdits = Readonly<Record<string, number | null>>;

export type AwardDraft = readonly [AwardEdits, (next: AwardEdits) => void];

export interface ProposalAwards {
  amounts: ReadonlyMap<string, number | null>;
  getRequested: (proposalId: string) => MoneyAmount | undefined;
  getCurrency: (proposalId: string) => string;
  hasAdjusted: (proposalId: string) => boolean;
  isValid: (proposalId: string) => boolean;
  invalidSelectedIds: string[];
  total: MoneyAmount | null;
  totalRequested: MoneyAmount | null;
  isOverBudget: boolean;
  canConfirm: boolean;
  allocations: () => ProposalAllocation[] | undefined;
  setAmount: (proposalId: string, amount: number | null) => void;
  reset: () => void;
}

export const useProposalAwards = ({
  proposals,
  selectedIds,
  isEnabled,
  processBudget,
  draft,
}: {
  proposals: readonly AwardProposal[];
  selectedIds: readonly string[];
  isEnabled: boolean;
  processBudget?: number;
  draft?: AwardDraft;
}): ProposalAwards => {
  const own = useState<AwardEdits>({});
  const [edits, setEdits] = draft ?? own;
  // Two edits in one tick (a field's onChange and the caption's reset) must
  // both land, so each write builds on the newest edits, not on the render's.
  const latest = useRef(edits);
  latest.current = edits;

  const requested = useMemo(
    () =>
      new Map(
        isEnabled
          ? proposals.map((proposal) => {
              const { budget } = resolveProposalSystemFields(proposal);
              return [
                proposal.id,
                budget?.amount
                  ? {
                      amount: budget.amount,
                      currency: getBudgetCurrency(budget),
                    }
                  : undefined,
              ];
            })
          : [],
      ),
    [proposals, isEnabled],
  );

  const amounts = useMemo(
    () =>
      new Map(
        proposals.map((proposal) => [
          proposal.id,
          proposal.id in edits
            ? (edits[proposal.id] ?? null)
            : (requested.get(proposal.id)?.amount ?? null),
        ]),
      ),
    [proposals, edits, requested],
  );

  const selected = useMemo(() => {
    const listed = new Set(proposals.map((proposal) => proposal.id));
    return selectedIds.filter((id) => listed.has(id));
  }, [proposals, selectedIds]);

  const isValid = (proposalId: string) =>
    isValidAwardAmount(amounts.get(proposalId));
  const invalidSelectedIds = isEnabled
    ? selected.filter((id) => !isValid(id))
    : [];

  const currency = singleCurrency(
    selected.map(
      (id) => requested.get(id)?.currency ?? getBudgetCurrency(undefined),
    ),
  );
  const total = isEnabled && currency ? sum(selected, amounts, currency) : null;
  const totalRequested =
    isEnabled && currency
      ? sum(
          selected,
          new Map(
            selected.map((id) => [id, requested.get(id)?.amount ?? null]),
          ),
          currency,
        )
      : null;
  const isOverBudget =
    isEnabled &&
    processBudget !== undefined &&
    total !== null &&
    total.amount > processBudget;

  const setAmount = useCallback(
    (proposalId: string, amount: number | null) => {
      latest.current = { ...latest.current, [proposalId]: amount };
      setEdits(latest.current);
    },
    [setEdits],
  );

  return {
    amounts,
    getRequested: (proposalId) => requested.get(proposalId),
    getCurrency: (proposalId) => getBudgetCurrency(requested.get(proposalId)),
    hasAdjusted: (proposalId) =>
      amounts.get(proposalId) !== (requested.get(proposalId)?.amount ?? null),
    isValid,
    invalidSelectedIds,
    total,
    totalRequested,
    isOverBudget,
    canConfirm:
      !isEnabled || (invalidSelectedIds.length === 0 && !isOverBudget),
    allocations: () =>
      isEnabled
        ? selected.flatMap((proposalId): ProposalAllocation[] => {
            const amount = amounts.get(proposalId);
            return isValidAwardAmount(amount) ? [{ proposalId, amount }] : [];
          })
        : undefined,
    setAmount,
    reset: () => setEdits({}),
  };
};

export const isValidAwardAmount = (
  amount: number | null | undefined,
): amount is number =>
  amount != null &&
  proposalAllocationSchema.shape.amount.safeParse(amount).success;

const singleCurrency = (currencies: readonly string[]): string | undefined => {
  const distinct = new Set(currencies);
  const [currency] = distinct;
  return distinct.size === 1 ? currency : undefined;
};

const sum = (
  ids: readonly string[],
  amounts: ReadonlyMap<string, number | null>,
  currency: string,
): MoneyAmount => ({
  amount: sumAmounts(
    ids.flatMap((id) => {
      const amount = amounts.get(id);
      return isValidAwardAmount(amount) ? [amount] : [];
    }),
  ),
  currency,
});
