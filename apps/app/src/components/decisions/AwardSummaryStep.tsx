'use client';

import { formatCurrency } from '@/utils/formatting';
import type { Proposal } from '@op/common/client';
import { Alert, AlertDescription } from '@op/sense/Alert';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { DialogFooter } from '@op/sense/Dialog';
import { Header3 } from '@op/sense/Header';
import { StatusBadge } from '@op/sense/StatusBadge';
import { LuCircleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { formatBudget } from './BudgetDisplay';
import { resolvePresentationFields } from './selection/proposalPresentation';
import { type ProposalAwards, isValidAwardAmount } from './useProposalAwards';

interface AwardSummaryStepProps {
  proposals: Proposal[];
  awards: ProposalAwards;
  onContinue: () => void;
}

export const AwardSummaryStep = ({
  proposals,
  awards,
  onContinue,
}: AwardSummaryStepProps) => {
  const t = useTranslations();
  const { total, totalRequested } = awards;
  const showRequestedTotal =
    total !== null &&
    totalRequested !== null &&
    total.amount !== totalRequested.amount;
  const blockedWarningKey = getBlockedWarningKey(awards);

  return (
    <>
      <div className="flex flex-col gap-4 px-6 py-4">
        {blockedWarningKey ? (
          <Alert variant="destructive">
            <LuCircleAlert aria-hidden />
            <AlertDescription>{t(blockedWarningKey)}</AlertDescription>
          </Alert>
        ) : null}
        <p className="text-base">
          {t('decisions.review.awardAmountsDescription')}
        </p>

        <Header3>{t('decisions.review.selectedProposalsHeading')}</Header3>

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
          <div
            aria-live="polite"
            className="flex items-start justify-between gap-4 border-t pt-3"
          >
            <span className="text-sm text-muted-foreground">
              {t('decisions.review.totalAwardedLabel')}
            </span>
            <span className="flex flex-col items-end">
              <span className="font-strong">{formatBudget(total)}</span>
              {showRequestedTotal ? (
                <span className="text-sm text-muted-foreground">
                  {t('decisions.review.requestedAmount', {
                    amount: formatBudget(totalRequested) ?? '',
                  })}
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button
          onClick={onContinue}
          disabled={proposals.length === 0 || !awards.canConfirm}
        >
          {t('Continue')}
        </Button>
      </DialogFooter>
    </>
  );
};

const getBlockedWarningKey = (awards: ProposalAwards) => {
  if (awards.canConfirm) {
    return undefined;
  }
  if (awards.invalidSelectedIds.length > 0) {
    return 'decisions.review.awardsInvalidWarning' as const;
  }
  if (awards.isOverBudget) {
    return 'decisions.review.awardsOverBudgetWarning' as const;
  }
  return 'decisions.review.mixedCurrenciesWarning' as const;
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
  awards: ProposalAwards;
}) => {
  const t = useTranslations();
  const amount = awards.amounts.get(proposal.id) ?? null;

  return isValidAwardAmount(amount) ? (
    <StatusBadge variant="success" icon={false} className="shrink-0">
      {t('decisions.amountAwarded', {
        amount: formatCurrency(
          amount,
          undefined,
          awards.getCurrency(proposal.id),
        ),
      })}
    </StatusBadge>
  ) : (
    <span className="shrink-0 text-sm text-destructive">
      {t('decisions.review.awardedAmountError')}
    </span>
  );
};

const getSummaryId = (proposal: Proposal) => `award-summary-${proposal.id}`;
