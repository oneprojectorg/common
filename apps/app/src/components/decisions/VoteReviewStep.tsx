'use client';

import type { Proposal } from '@op/common/client';
import { useId } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalMiniCard } from './ProposalCard';

interface VoteReviewStepProps {
  proposals: Proposal[];
}

/**
 * Body of the vote confirmation dialog: the "Selected proposals" label plus the
 * mini cards for the ballot. The introductory sentence lives in the dialog's
 * `DialogDescription` so screen readers announce it with the title.
 */
export const VoteReviewStep = ({ proposals }: VoteReviewStepProps) => {
  const t = useTranslations();
  const labelId = useId();

  return (
    <div className="space-y-2">
      <h3 id={labelId} className="text-sm text-neutral-gray4">
        {t('Selected proposals')}
      </h3>

      <ul aria-labelledby={labelId} className="space-y-2">
        {proposals.map((proposal) => (
          <li key={proposal.id}>
            <ProposalMiniCard proposal={proposal} />
          </li>
        ))}
      </ul>
    </div>
  );
};
