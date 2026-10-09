'use client';

import { formatCurrency } from '@/utils/formatting';
import {
  type MoneyAmount,
  type Proposal,
  type ProposalAllocation,
  getCurrencySymbol,
  proposalAllocationSchema,
} from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { DialogFooter } from '@op/sense/Dialog';
import { Header3 } from '@op/sense/Header';
import { NumberField } from '@op/sense/NumberField';
import { StatusBadge } from '@op/sense/StatusBadge';
import { Toggle } from '@op/sense/Toggle';
import { useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { LuBadgeCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { formatBudget, getBudgetCurrency } from './BudgetDisplay';
import { resolveProposalSystemFields } from './proposalContentUtils';
import { resolvePresentationFields } from './selection/proposalPresentation';

type AwardAmounts = ReturnType<typeof useAwardAmounts>;

interface AwardAmountsStepProps {
  proposals: Proposal[];
  awards: AwardAmounts;
  onCancel: () => void;
  onContinue: () => void;
}

/**
 * First step of the final-phase confirm dialog: the winning proposals with the
 * amount each is awarded. Amounts start at the requested budget; "Adjust
 * amounts" swaps the awarded badges for fields.
 */
export const AwardAmountsStep = ({
  proposals,
  awards,
  onCancel,
  onContinue,
}: AwardAmountsStepProps) => {
  const t = useTranslations();
  const total = getTotalAwarded({ proposals, awards });

  return (
    <>
      <div className="flex flex-col gap-4 px-6 py-4">
        <p className="text-base">
          {t('decisions.review.awardAmountsDescription')}
        </p>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Header3>{t('decisions.review.selectedProposalsHeading')}</Header3>
          <Toggle
            variant="outline"
            size="sm"
            pressed={awards.isAdjusting}
            onPressedChange={awards.setAdjusting}
          >
            {t('decisions.review.adjustAmountsAction')}
          </Toggle>
        </div>

        <ul className="flex flex-col gap-3">
          {proposals.map((proposal) => (
            <li
              key={proposal.id}
              className="flex flex-col gap-3 rounded-lg border bg-muted p-4 sm:flex-row sm:justify-between sm:gap-6"
            >
              <AwardProposalSummary proposal={proposal} />
              <AwardedAmount proposal={proposal} awards={awards} />
            </li>
          ))}
        </ul>

        {total ? (
          <div className="flex items-center justify-between gap-4 border-t pt-3">
            <span className="text-sm text-muted-foreground">
              {t('decisions.review.totalAwardedLabel')}
            </span>
            <span className="font-strong" aria-live="polite">
              {formatBudget(total)}
            </span>
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          {t('Cancel')}
        </Button>
        <Button onClick={onContinue} disabled={proposals.length === 0}>
          {t('Continue')}
        </Button>
      </DialogFooter>
    </>
  );
};

/**
 * State for {@link AwardAmountsStep}. Only the amounts the admin typed are
 * stored; the rest default to the requested budget, so a proposal that joins
 * the live selection mid-dialog gets one too. When not enabled nothing is
 * awarded: `getAllocations` returns undefined and the amounts always pass.
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
    validate,
    currencyOf: (proposalId: string) =>
      getBudgetCurrency(requested.get(proposalId)),
    getAllocations: () =>
      isEnabled
        ? proposals.flatMap((proposal): ProposalAllocation[] => {
            const amount = amounts.get(proposal.id);
            return isValidAwardAmount(amount)
              ? [{ proposalId: proposal.id, amount }]
              : [];
          })
        : undefined,
    reset: () => {
      setIsAdjusting(false);
      setShowErrors(false);
      setEdits(new Map());
    },
    setAdjusting: (next: boolean) => {
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

const AwardProposalSummary = ({ proposal }: { proposal: Proposal }) => {
  const t = useTranslations();
  const { title, submitterName, budget, categories } =
    resolvePresentationFields({
      proposal,
      defaultTitle: t('decisions.proposals.untitledProposal'),
    });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <span id={summaryId(proposal)} className="font-serif text-title">
        <bdi>{title}</bdi>
      </span>
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {submitterName ? <bdi>{submitterName}</bdi> : null}
        {submitterName && budget ? <Bullet /> : null}
        {budget ? (
          <Badge variant="outline">
            {t('decisions.proposals.amountRequested', { amount: budget })}
          </Badge>
        ) : null}
        {categories.map((category) => (
          <Badge key={category} variant="secondary">
            <bdi>{category}</bdi>
          </Badge>
        ))}
      </div>
    </div>
  );
};

const AwardedAmount = ({
  proposal,
  awards,
}: {
  proposal: Proposal;
  awards: AwardAmounts;
}) => {
  const t = useTranslations();
  const amount = awards.amounts.get(proposal.id) ?? null;
  const currency = awards.currencyOf(proposal.id);

  if (awards.isAdjusting) {
    return (
      <NumberField
        ref={(input) => awards.registerInput(proposal.id, input)}
        label={t('decisions.review.awardedAmountLabel')}
        prefixText={getCurrencySymbol(currency)}
        value={amount}
        onChange={(next) => awards.setAmount(proposal.id, next)}
        aria-describedby={summaryId(proposal)}
        errorMessage={
          awards.showErrors && !isValidAwardAmount(amount)
            ? t('decisions.review.awardedAmountInvalid')
            : undefined
        }
        className="shrink-0 sm:w-48"
      />
    );
  }

  return isValidAwardAmount(amount) ? (
    <StatusBadge variant="success" icon={LuBadgeCheck} className="shrink-0">
      {t('decisions.amountAwarded', {
        amount: formatCurrency(amount, undefined, currency),
      })}
    </StatusBadge>
  ) : null;
};

// The service's rule, so the step never passes an amount it would refuse.
const isValidAwardAmount = (
  amount: number | null | undefined,
): amount is number =>
  amount != null &&
  proposalAllocationSchema.shape.amount.safeParse(amount).success;

// Links each amount field to the title it is for; the visible label alone
// reads the same on every row.
const summaryId = (proposal: Proposal) => `award-summary-${proposal.id}`;

/**
 * Sum of the valid amounts, or `null` when the rows mix currencies and a
 * single figure would be meaningless.
 */
function getTotalAwarded({
  proposals,
  awards,
}: {
  proposals: Proposal[];
  awards: AwardAmounts;
}): MoneyAmount | null {
  const currencies = new Set(
    proposals.map((proposal) => awards.currencyOf(proposal.id)),
  );
  const [currency] = currencies;
  if (currency === undefined || currencies.size > 1) {
    return null;
  }

  const amount = proposals.reduce((sum, proposal) => {
    const awarded = awards.amounts.get(proposal.id);
    return isValidAwardAmount(awarded) ? sum + awarded : sum;
  }, 0);

  return { amount, currency };
}
