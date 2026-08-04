'use client';

import type { Proposal } from '@op/common/client';

import { useTranslations } from '@/lib/i18n';

import { ProposalMiniCard } from './ProposalCard';

interface VoteReviewStepProps {
  proposals: Proposal[];
}

export const VoteReviewStep = ({ proposals }: VoteReviewStepProps) => {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <p className="text-base text-neutral-charcoal">
        {t('Please confirm your selections before submitting')}
      </p>

      <div className="space-y-2">
        <div className="text-sm tracking-wider text-neutral-gray4 uppercase">
          {t('YOUR SELECTED PROPOSALS')}
        </div>

        {proposals.map((proposal) => (
          <ProposalMiniCard key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </div>
  );
};
