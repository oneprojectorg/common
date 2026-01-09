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
        <div className="tracking-wider text-sm text-neutral-gray4 uppercase">
          {t('YOUR SELECTED PROPOSALS')}
        </div>

        {proposals.map((proposal) => {
          return (
            <ProposalCard className="p-3 bg-neutral-offWhite" key={proposal.id}>
              <ProposalCardContent>
                <ProposalCardHeader
                  className="flex-row flex-wrap justify-between"
                  proposal={proposal}
                />
                <div className="gap-2 flex items-center">
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
