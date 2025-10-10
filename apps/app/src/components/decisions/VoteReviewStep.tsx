'use client';

import type { proposalEncoder } from '@op/api/encoders';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import {
  ProposalCard,
  ProposalCardCategory,
  ProposalCardContent,
  ProposalCardHeader,
} from './ProposalCard';

type Proposal = z.infer<typeof proposalEncoder>;

interface VoteReviewStepProps {
  proposals: Proposal[];
  maxVotes: number;
}

export const VoteReviewStep = ({ proposals }: VoteReviewStepProps) => {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <p className="text-base text-neutral-charcoal">
        {t('Please confirm your selections before submitting')}
      </p>

      <div className="space-y-2">
        <div className="text-sm uppercase tracking-wider text-neutral-gray4">
          {t('YOUR SELECTED PROPOSALS')}
        </div>

        {proposals.map((proposal) => {
          return (
            <ProposalCard className="bg-neutral-offWhite p-3" key={proposal.id}>
              <ProposalCardContent>
                <ProposalCardHeader
                  className="flex-row flex-wrap justify-between"
                  proposal={proposal}
                />
                <div className="flex items-center gap-2">
                  <span className="text-sm text-neutral-charcoal">
                    {proposal.submittedBy?.name}
                  </span>

                  <ProposalCardCategory proposal={proposal} />
                </div>
              </ProposalCardContent>
            </ProposalCard>
          );
        })}
      </div>
    </div>
  );
};
