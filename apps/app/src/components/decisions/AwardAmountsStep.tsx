'use client';

import { formatCurrency } from '@/utils/formatting';
import {
  type MoneyAmount,
  type Proposal,
  getCurrencySymbol,
} from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { DialogFooter } from '@op/sense/Dialog';
import { Header3 } from '@op/sense/Header';
import { NumberField } from '@op/sense/NumberField';
import { StatusBadge } from '@op/sense/StatusBadge';
import { Toggle } from '@op/sense/Toggle';
import { LuBadgeCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { formatBudget } from './BudgetDisplay';
import { resolvePresentationFields } from './selection/proposalPresentation';
import { type AwardAmounts, isValidAwardAmount } from './useAwardAmounts';

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
            onPressedChange={awards.toggleAdjusting}
          >
            {t('decisions.review.adjustAmountsAction')}
          </Toggle>
        </div>

        <ul className="flex flex-col gap-3">
          {proposals.map((proposal) => (
            <li
              key={proposal.id}
              aria-labelledby={getSummaryId(proposal)}
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
            <span className="font-strong">{formatBudget(total)}</span>
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

const AwardProposalSummary = ({ proposal }: { proposal: Proposal }) => {
  const t = useTranslations();
  const { title, submitterName, budget, categories } =
    resolvePresentationFields({
      proposal,
      defaultTitle: t('decisions.proposals.untitledProposal'),
    });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <p id={getSummaryId(proposal)} className="font-serif text-title">
        <bdi>{title}</bdi>
      </p>
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
  const currency = awards.getCurrency(proposal.id);

  if (awards.isAdjusting) {
    return (
      <NumberField
        ref={(input) => awards.registerInput(proposal.id, input)}
        label={t('decisions.review.awardedAmountLabel')}
        prefixText={getCurrencySymbol(currency)}
        value={amount}
        onChange={(next) => awards.setAmount(proposal.id, next)}
        aria-describedby={getSummaryId(proposal)}
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

// Links each amount field to the title it is for; the visible label alone
// reads the same on every row.
const getSummaryId = (proposal: Proposal) => `award-summary-${proposal.id}`;

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
    proposals.map((proposal) => awards.getCurrency(proposal.id)),
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
