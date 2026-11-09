'use client';

import { ProposalReviewRequestState } from '@op/common/client';

import { ProposalBody } from '../Proposal/ProposalBody';
import { ProposalCommentsSection } from '../Proposal/ProposalCommentsSection';
import {
  ProposalContext,
  useProposalContextValue,
} from '../Proposal/proposalContext';
import { AuthorNotesSection } from './AuthorNotesSection';
import { RevisedOnBadge } from './AuthorRevisionNote';
import { useReviewForm } from './ReviewFormContext';

export function ReviewProposalPane({
  decisionRoot,
}: {
  /** Route prefix for sibling proposals, e.g. `/decisions/participatory-budget`. */
  decisionRoot: string;
}) {
  const { assignment, ownLatestRevisionRequest } = useReviewForm();

  // The version under review comes with the assignment, so it is not
  // re-fetched (no `documentState`) and the body offers no like/follow.
  const proposalContext = useProposalContextValue({
    proposal: assignment.proposal,
    decisionRoot,
  });

  const respondedAt =
    ownLatestRevisionRequest?.state === ProposalReviewRequestState.RESUBMITTED
      ? ownLatestRevisionRequest.respondedAt
      : null;

  return (
    <ProposalContext.Provider value={proposalContext}>
      <ProposalBody
        engagement={false}
        // The badge shows on the date alone, so a note-less resubmission
        // still shows.
        submissionMetaSuffix={
          respondedAt ? <RevisedOnBadge respondedAt={respondedAt} /> : undefined
        }
        headerBanner={
          <AuthorNotesSection proposalId={assignment.proposal.id} />
        }
      >
        <ProposalCommentsSection readOnly />
      </ProposalBody>
    </ProposalContext.Provider>
  );
}
