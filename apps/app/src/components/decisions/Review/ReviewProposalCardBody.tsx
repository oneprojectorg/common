import type { Proposal } from '@op/common/client';
import { LuRefreshCw } from 'react-icons/lu';

import { TranslatedText } from '@/components/TranslatedText';

import { Bullet } from '../../Bullet';
import {
  ProposalCardAuthor,
  ProposalCardCategory,
  ProposalCardContent,
  ProposalCardHeader,
  ProposalCardPreview,
} from '../ProposalCard';

export function ReviewProposalCardBody({
  proposal,
  viewHref,
  isRevised = false,
}: {
  proposal: Proposal;
  viewHref?: string;
  isRevised?: boolean;
}) {
  return (
    <ProposalCardContent>
      <ProposalCardHeader proposal={proposal} viewHref={viewHref} />
      <div className="flex flex-wrap items-center gap-2">
        <ProposalCardAuthor proposal={proposal} />
        <ProposalCardCategory proposal={proposal} />
        {isRevised ? <RevisedIndicator /> : null}
      </div>
      <ProposalCardPreview proposal={proposal} className="line-clamp-2" />
    </ProposalCardContent>
  );
}

function RevisedIndicator() {
  return (
    <>
      <Bullet />
      <div className="flex items-center gap-1">
        <LuRefreshCw className="size-4 text-primary-orange2" />
        <span className="text-sm text-neutral-charcoal">
          <TranslatedText text="Revised" />
        </span>
      </div>
    </>
  );
}
