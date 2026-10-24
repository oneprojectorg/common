'use client';

import type { Proposal } from '@op/common/client';
import { Header4 } from '@op/sense/Header';
import { Progress } from '@op/sense/Progress';
import { type ReactNode, useId } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalMiniCard } from './ProposalCard';
import {
  type BallotBudget,
  formatBallotAmount,
  getBallotTotal,
} from './ballot';

interface VoteReviewStepProps {
  /** In ballot order, which is the rank on a ranked vote. */
  proposals: Proposal[];
  ranked: boolean;
  budget?: BallotBudget;
}

/**
 * Body of the vote confirmation dialog: the "Selected proposals" label, a mini
 * card per pick (numbered on a ranked vote), and what the ballot spends.
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
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Header4 id={labelId}>
          {t('decisions.review.selectedProposalsHeading')}
        </Header4>
        <List aria-labelledby={labelId} className="flex flex-col gap-4">
          {proposals.map((proposal, index) => (
            <li key={proposal.id}>
              <ProposalMiniCard
                proposal={proposal}
                rank={ranked ? index + 1 : undefined}
              />
            </li>
          ))}
        </List>
      </div>

      {budget && <BallotSpend proposals={proposals} budget={budget} />}
    </div>
  );
};

/** A bar of the budget the ballot spends, with "$X of $Y allocated" under it. */
const BallotSpend = ({
  proposals,
  budget,
}: {
  proposals: Proposal[];
  budget: BallotBudget;
}) => {
  const t = useTranslations('decisions.proposals');
  const total = getBallotTotal({ proposals, budget });
  const allocated = formatBallotAmount({ amount: total, unit: budget.unit });
  const voterBudget = formatBallotAmount({
    amount: budget.voterBudget,
    unit: budget.unit,
  });

  return (
    <div className="flex flex-col gap-3">
      <Progress
        value={Math.min(total, budget.voterBudget)}
        max={budget.voterBudget}
        aria-label={t('budgetAllocatedLabel')}
        getAriaValueText={() =>
          t('budgetAllocatedSummary', { allocated, budget: voterBudget })
        }
      />
      <p className="text-muted-foreground tabular-nums">
        {t.rich('budgetAllocatedOfTotal', {
          allocated,
          budget: voterBudget,
          highlight: (chunks: ReactNode) => (
            <span className="text-foreground">{chunks}</span>
          ),
        })}
      </p>
    </div>
  );
};
