'use client';

import { ProposalReviewRequestState } from '@op/common/client';

import { useProcessCapabilities } from '../ProcessCapabilitiesContext';
import { ProposalComments } from '../ProposalComments';
import { ProposalPreview } from '../ProposalPreview';
import { AuthorNotesSection } from './AuthorNotesSection';
import { RevisedOnBadge } from './AuthorRevisionNote';
import { useReviewForm } from './ReviewFormContext';
import { useReviewTranslation } from './ReviewTranslationContext';

export function ReviewProposalPane({
  decisionRoot,
}: {
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
}) {
  const { assignment, ownLatestRevisionRequest } = useReviewForm();
  const { comments: commentsEnabled } = useProcessCapabilities();
  const { proposal: translation } = useReviewTranslation();

  const respondedAt =
    ownLatestRevisionRequest?.state === ProposalReviewRequestState.RESUBMITTED
      ? ownLatestRevisionRequest.respondedAt
      : null;

  return (
    // Same section rhythm as the proposal view: the sections below mirror this
    // gap in their own `pt`, which keeps each rule centred between them.
    <div className="flex flex-col gap-6 sm:gap-10">
      <ProposalPreview
        proposal={assignment.proposal}
        translation={translation}
        // The badge shows on the date alone, so a note-less resubmission
        // still shows.
        submissionMetaSuffix={
          respondedAt ? <RevisedOnBadge respondedAt={respondedAt} /> : undefined
        }
        headerBanner={
          <AuthorNotesSection proposalId={assignment.proposal.id} />
        }
      />

      {commentsEnabled && (
        <ProposalComments
          proposal={assignment.proposal}
          decisionRoot={decisionRoot}
          readOnly
        />
      )}
    </div>
  );
}
