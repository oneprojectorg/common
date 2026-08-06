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
        // The banner needs a comment to show; the date doesn't. A resubmission
        // without one would otherwise leave the reviewer no sign it happened
        // (`responseComment` is null when the author left it empty).
        submissionMetaSuffix={
          respondedAt ? <RevisedOnBadge respondedAt={respondedAt} /> : undefined
        }
        headerBanner={
          responseComment ? (
            <AuthorRevisionNote
              comment={responseComment}
              respondedAt={respondedAt}
            />
          ) : undefined
        }
      />

      <ProposalComments proposal={assignment.proposal} readOnly />
    </div>
  );
}
