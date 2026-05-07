import type { Proposal } from '@op/common/client';

import {
  ProposalCardAuthor,
  ProposalCardCategory,
  ProposalCardContent,
  ProposalCardHeader,
  ProposalCardPreview,
} from '../ProposalCard';
import { RevisedIndicator } from './RevisedIndicator';

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
