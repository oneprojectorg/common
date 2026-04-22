'use client';

import { ProposalReviewRequestState } from '@op/common/client';
import { cn } from '@op/ui/utils';

import { ProposalPreview } from '../ProposalPreview';
import { AuthorRevisionNote, RevisedOnBadge } from './AuthorRevisionNote';
import { useReviewForm } from './ReviewFormContext';

export function ReviewProposalPane({ className }: { className?: string }) {
  const { proposal, revisionRequest } = useReviewForm();

  const respondedAt =
    revisionRequest?.state === ProposalReviewRequestState.RESUBMITTED
      ? revisionRequest.respondedAt
      : null;
  const responseComment = respondedAt ? revisionRequest?.responseComment : null;

  return (
    <div className={cn('min-w-0 flex-1 overflow-y-auto', className)}>
      <ProposalPreview
        proposal={proposal}
        submissionMetaSuffix={
          respondedAt ? <RevisedOnBadge respondedAt={respondedAt} /> : undefined
        }
        headerBanner={
          responseComment ? (
            <AuthorRevisionNote comment={responseComment} />
          ) : undefined
        }
      />
    </div>
  );
}
