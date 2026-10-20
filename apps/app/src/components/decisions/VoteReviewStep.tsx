'use client';

import type { Proposal } from '@op/common/client';
import { Alert, AlertDescription } from '@op/sense/Alert';
import { BadgeNumber } from '@op/sense/Badge';
import { Header4 } from '@op/sense/Header';
import { useId } from 'react';
import { LuInfo } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { BallotBudgetMeter } from './BallotBudgetMeter';
import { ProposalMiniCard } from './ProposalCard';
import type { BallotBudget } from './ballot';

interface VoteReviewStepProps {
  /** In ballot order, which is the rank on a ranked vote. */
  proposals: Proposal[];
  ranked: boolean;
  budget?: BallotBudget;
}

/**
 * Body of the vote confirmation dialog: the "Selected proposals" label plus the
 * mini cards for the ballot. The introductory sentence lives in the dialog's
 * `DialogDescription` so screen readers announce it with the title.
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
    <div className="space-y-4">
      <Header4 id={labelId}>
        {t('decisions.review.selectedProposalsHeading')}
      </Header4>

      <List aria-labelledby={labelId} className="space-y-4">
        {proposals.map((proposal, index) => (
          <li key={proposal.id} className="flex items-start gap-3">
            {ranked && (
              <BadgeNumber aria-hidden className="mt-4">
                {index + 1}
              </BadgeNumber>
            )}
            <ProposalMiniCard proposal={proposal} className="min-w-0 flex-1" />
          </li>
        ))}
      </List>

      {budget && <BallotBudgetMeter ballot={proposals} budget={budget} />}

      {ranked && (
        <Alert variant="info" role="note">
          <LuInfo aria-hidden />
          <AlertDescription>
            {t('decisions.proposals.rankedBallotHint')}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};
