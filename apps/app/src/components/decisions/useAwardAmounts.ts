'use client';

import {
  type Proposal,
  type ProposalAllocation,
  proposalAllocationSchema,
} from '@op/common/client';
import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';

import { getBudgetCurrency } from './BudgetDisplay';
import { resolveProposalSystemFields } from './proposalContentUtils';

export type AwardAmounts = ReturnType<typeof useAwardAmounts>;

/**
 * State for the amounts step of the final-phase confirm dialog. Only the
 * amounts the admin typed are stored; the rest default to the requested
 * budget. When not enabled nothing is awarded: publishing hands over no
 * allocations and the amounts always pass.
 */
export const useAwardAmounts = ({
  proposals,
  isEnabled,
}: {
  proposals: Proposal[];
  isEnabled: boolean;
}) => {
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [edits, setEdits] = useState<ReadonlyMap<string, number | null>>(
    () => new Map(),
  );
  // The amounts the admin confirmed, per winner, so a selection or budget
  // that moves afterwards (another tab, a refetch) can't publish an amount
  // nobody saw.
  const [confirmed, setConfirmed] = useState<
    ReadonlyMap<string, number | null>
  >(() => new Map());
  const inputs = useRef(new Map<string, HTMLInputElement>());

  // Resolving a proposal's fields can walk its rich-text fragments, so it runs
  // once per selection change rather than on every keystroke.
  const requested = useMemo(
    () =>
      new Map(
        isEnabled
          ? proposals.map((proposal) => [
              proposal.id,
              resolveProposalSystemFields(proposal).budget,
            ])
          : [],
      ),
    [proposals, isEnabled],
  );

  const amounts = new Map(
    proposals.map((proposal) => [
      proposal.id,
      edits.has(proposal.id)
        ? (edits.get(proposal.id) ?? null)
        : (requested.get(proposal.id)?.amount ?? null),
    ]),
  );
  const firstInvalid = isEnabled
    ? proposals.find(
        (proposal) => !isValidAwardAmount(amounts.get(proposal.id)),
      )
    : undefined;
  const isConfirmedSelection =
    confirmed.size === proposals.length &&
    proposals.every(
      (proposal) =>
        confirmed.has(proposal.id) &&
        confirmed.get(proposal.id) === amounts.get(proposal.id),
    );

  // flushSync so the fields exist before focus moves into them.
  const focusAmount = (proposalId: string) => {
    flushSync(() => setIsAdjusting(true));
    inputs.current.get(proposalId)?.focus();
  };

  /** Whether every amount is valid; if not, flags them and focuses the first. */
  const validate = () => {
    if (!firstInvalid) {
      return true;
    }
    setShowErrors(true);
    focusAmount(firstInvalid.id);
    return false;
  };

  return {
    amounts,
    isAdjusting,
    showErrors,
    getCurrency: (proposalId: string) =>
      getBudgetCurrency(requested.get(proposalId)),
    reset: () => {
      setIsAdjusting(false);
      setShowErrors(false);
      setEdits(new Map());
      setConfirmed(new Map());
    },
    /** Moves on once every amount is valid, remembering what was confirmed. */
    confirm: (onConfirmed: () => void) => {
      if (validate()) {
        setConfirmed(new Map(amounts));
        onConfirmed();
      }
    },
    /**
     * Publishes the confirmed amounts, or reopens the step when the winners
     * or their amounts changed since they were confirmed.
     */
    publish: ({
      onPublish,
      onReopen,
    }: {
      onPublish: (allocations: ProposalAllocation[] | undefined) => void;
      onReopen: () => void;
    }) => {
      if (!isEnabled) {
        onPublish(undefined);
        return;
      }
      if (isConfirmedSelection && !firstInvalid) {
        onPublish(
          proposals.flatMap((proposal): ProposalAllocation[] => {
            const amount = amounts.get(proposal.id);
            return isValidAwardAmount(amount)
              ? [{ proposalId: proposal.id, amount }]
              : [];
          }),
        );
        return;
      }
      flushSync(onReopen);
      validate();
    },
    /** Opening the fields focuses the first; closing them needs valid amounts. */
    toggleAdjusting: (next: boolean) => {
      const [first] = proposals;
      if (next && first) {
        focusAmount(first.id);
      } else if (!next && validate()) {
        setIsAdjusting(false);
      }
    },
    setAmount: (proposalId: string, amount: number | null) =>
      setEdits((prev) => new Map(prev).set(proposalId, amount)),
    registerInput: (proposalId: string, input: HTMLInputElement | null) => {
      if (input) {
        inputs.current.set(proposalId, input);
      } else {
        inputs.current.delete(proposalId);
      }
    },
  };
};

// The service's rule, so the step never passes an amount it would refuse.
export const isValidAwardAmount = (
  amount: number | null | undefined,
): amount is number =>
  amount != null &&
  proposalAllocationSchema.shape.amount.safeParse(amount).success;
