'use client';

import type { Proposal } from '@op/common/client';
import { Alert, AlertDescription } from '@op/sense/Alert';
import { Badge, BadgeNumber } from '@op/sense/Badge';
import { Card } from '@op/sense/Card';
import { Header3, Header4 } from '@op/sense/Header';
import { type ReactNode, useId } from 'react';
import { LuInfo } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { BallotBudgetMeter } from './BallotBudgetMeter';
import {
  type BallotBudget,
  formatBallotAmount,
  getBallotRemaining,
  getBallotTotal,
  getProposalCost,
} from './ballot';
import { resolvePresentationFields } from './selection/proposalPresentation';

interface VoteReviewStepProps {
  /** In ballot order, which is the rank on a ranked vote. */
  proposals: Proposal[];
  ranked: boolean;
  budget?: BallotBudget;
}

/**
 * Body of the vote confirmation dialog: the "Selected proposals" label plus a
 * card per pick, numbered on a ranked vote. The introductory sentence lives in
 * the dialog's `DialogDescription` so screen readers announce it with the
 * title.
 */
export const VoteReviewStep = ({
  proposals,
  ranked,
  budget,
}: VoteReviewStepProps) => {
  const t = useTranslations();
  const labelId = useId();
  const List = ranked ? 'ol' : 'ul';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <Header4 id={labelId} className="font-sans text-base font-strong">
          {t('decisions.review.selectedProposalsHeading')}
        </Header4>
        {budget && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {t('decisions.proposals.budgetSpentOfTotal', {
              allocated: formatBallotAmount({
                amount: getBallotTotal({ proposals, budget }),
                unit: budget.unit,
              }),
              budget: formatBallotAmount({
                amount: budget.voterBudget,
                unit: budget.unit,
              }),
            })}
          </span>
        )}
      </div>

      <List aria-labelledby={labelId} className="flex flex-col gap-3">
        {proposals.map((proposal, index) => (
          <li key={proposal.id}>
            <BallotReviewCard
              proposal={proposal}
              rank={ranked ? index + 1 : undefined}
              budget={budget}
            />
          </li>
        ))}
      </List>

      {budget && (
        <BallotBudgetMeter
          ballot={proposals}
          budget={budget}
          className="flex-col items-stretch gap-2"
        >
          {t.rich('decisions.proposals.budgetAllocatedRemaining', {
            allocated: formatBallotAmount({
              amount: getBallotTotal({ proposals, budget }),
              unit: budget.unit,
            }),
            remaining: formatBallotAmount({
              amount: getBallotRemaining({ proposals, budget }),
              unit: budget.unit,
            }),
            highlight: (chunks: ReactNode) => (
              <span className="font-medium text-foreground">{chunks}</span>
            ),
          })}
        </BallotBudgetMeter>
      )}

      {ranked && (
        <Alert
          variant="info"
          role="note"
          className="border-transparent bg-accent text-accent-foreground"
        >
          <LuInfo aria-hidden />
          <AlertDescription className="text-sm text-accent-foreground">
            {t('decisions.proposals.rankedBallotHint')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

/** A pick on the review: its rank beside the title, then author, cost and categories. */
const BallotReviewCard = ({
  proposal,
  rank,
  budget,
}: {
  proposal: Proposal;
  rank?: number;
  budget?: BallotBudget;
}) => {
  const t = useTranslations();
  const fields = resolvePresentationFields({
    proposal,
    defaultTitle: t('decisions.proposals.untitledProposal'),
  });
  const cost = budget
    ? formatBallotAmount({
        amount: getProposalCost({ proposal, budget }),
        unit: budget.unit,
      })
    : fields.budget;

  return (
    <Card className="gap-2 px-4 shadow-none">
      <div className="flex items-start gap-2.5">
        {rank !== undefined && (
          <BadgeNumber aria-hidden className="h-6 min-w-6 font-medium">
            {rank}
          </BadgeNumber>
        )}
        <Header3 className="min-w-0">
          <bdi>{fields.title}</bdi>
        </Header3>
      </div>
      <div
        className={
          rank === undefined
            ? 'flex flex-wrap items-center gap-2'
            : 'flex flex-wrap items-center gap-2 ps-8.5'
        }
      >
        {fields.submitterName && (
          <span className="text-sm text-muted-foreground">
            <bdi>{fields.submitterName}</bdi>
          </span>
        )}
        {cost && <Badge variant="outline">{cost}</Badge>}
        {fields.categories.map((category) => (
          <Badge key={category} variant="secondary">
            <bdi>{category}</bdi>
          </Badge>
        ))}
      </div>
    </Card>
  );
};
