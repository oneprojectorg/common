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
  hasMixedCurrencies: boolean;
  isOverBudget: boolean;
  canConfirm: boolean;
  allocations: () => ProposalAllocation[] | undefined;
  setAmount: (proposalId: string, amount: number | null) => void;
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
  const latest = useRef(edits);
  latest.current = edits;

  const requested = useMemo(
    () =>
      new Map(
        isEnabled
          ? proposals.map((proposal) => [proposal.id, requestedOf(proposal)])
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
  const hasMixedCurrencies =
    isEnabled && selected.length > 0 && currency === undefined;
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
  const isUncheckable = processBudget !== undefined && hasMixedCurrencies;

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
    hasMixedCurrencies,
    isOverBudget,
    canConfirm:
      !isEnabled ||
      (invalidSelectedIds.length === 0 && !isOverBudget && !isUncheckable),
    allocations: () =>
      isEnabled
        ? selected.flatMap((proposalId): ProposalAllocation[] => {
            const amount = amounts.get(proposalId);
            return isValidAwardAmount(amount) ? [{ proposalId, amount }] : [];
          })
        : undefined,
    setAmount,
  };
};

const requestedCache = new WeakMap<AwardProposal, MoneyAmount | undefined>();

const requestedOf = (proposal: AwardProposal): MoneyAmount | undefined => {
  if (requestedCache.has(proposal)) {
    return requestedCache.get(proposal);
  }
  const { budget } = resolveProposalSystemFields(proposal);
  const requested =
    budget && typeof budget.amount === 'number'
      ? { amount: budget.amount, currency: getBudgetCurrency(budget) }
      : undefined;
  requestedCache.set(proposal, requested);
  return requested;
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
