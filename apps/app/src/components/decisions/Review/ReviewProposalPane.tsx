'use client';

import { ProposalReviewRequestState } from '@op/common/client';

import { ProposalComments } from '../ProposalComments';
import { ProposalPreview } from '../ProposalPreview';
import { AuthorRevisionNote, RevisedOnBadge } from './AuthorRevisionNote';
import { useReviewForm } from './ReviewFormContext';
import { useReviewTranslation } from './ReviewTranslationContext';

export function ReviewProposalPane({
  decisionRoot,
}: {
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
}) {
  const { assignment, ownLatestRevisionRequest } = useReviewForm();
  const { proposal: translation } = useReviewTranslation();

  // The author's note only exists on the reviewer's own request once it has
  // been answered, so read the latest own request rather than the still-open
  // one the rest of the form gates on.
  const respondedAt =
    ownLatestRevisionRequest?.state === ProposalReviewRequestState.RESUBMITTED
      ? ownLatestRevisionRequest.respondedAt
      : null;
  const responseComment = respondedAt
    ? ownLatestRevisionRequest?.responseComment
    : null;

  return (
    // Same section rhythm as the proposal view: the sections below mirror this
    // gap in their own `pt`, which keeps each rule centred between them.
    <div className="flex flex-col gap-6 sm:gap-10">
      <ProposalPreview
        proposal={assignment.proposal}
        translation={translation}
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
              revisionRequest={ownLatestRevisionRequest}
            />
          ) : undefined
        }
      />

      <ProposalComments
        proposal={assignment.proposal}
        decisionRoot={decisionRoot}
        readOnly
      />
    </div>
  );
}
