'use client';

import { ProposalReviewRequestState } from '@op/common/client';

import { ProposalComments } from '../ProposalComments';
import { ProposalPreview } from '../ProposalPreview';
import { AuthorRevisionNote, RevisedOnBadge } from './AuthorRevisionNote';
import { useReviewForm } from './ReviewFormContext';

export function ReviewProposalPane() {
  const { assignment, revisionRequest } = useReviewForm();

  const respondedAt =
    revisionRequest?.state === ProposalReviewRequestState.RESUBMITTED
      ? revisionRequest.respondedAt
      : null;
  const responseComment = respondedAt ? revisionRequest?.responseComment : null;

  return (
    <div className="flex flex-col gap-8">
      <ProposalPreview
        proposal={assignment.proposal}
        submissionMetaSuffix={
          respondedAt ? <RevisedOnBadge respondedAt={respondedAt} /> : undefined
        }
        headerBanner={
          responseComment ? (
            <AuthorRevisionNote comment={responseComment} />
          ) : undefined
        }
      />

      <ProposalComments proposal={assignment.proposal} readOnly />
    </div>
  );
}
