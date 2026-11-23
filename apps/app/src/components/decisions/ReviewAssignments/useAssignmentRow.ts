'use client';

import {
  ProposalReviewAssignmentStatus,
  ProposalReviewState,
  type ReviewAssignmentExtended,
} from '@op/common/client';

import { useProposalCardData } from '../ProposalCard';
import {
  type ProposalSheetRoute,
  useOpenProposalInSheet,
} from '../ProposalSheet/proposalSheetState';
import { isReviewShownOutOfDate } from '../ReviewStatusBadge';
import { proposalReviewsHref } from '../proposalHrefs';
import type { AssignmentStatusValue } from './assignmentStatusSpecs';

/** What a row shows for one assignment, and where it opens. */
export function useAssignmentRow({
  item: { assignment, review, isReviewOutOfDate },
  route,
}: {
  item: ReviewAssignmentExtended;
  route: ProposalSheetRoute;
}) {
  const openInSheet = useOpenProposalInSheet();
  const { proposal } = assignment;

  const { titleText, displayCategories, authors } = useProposalCardData({
    proposal,
  });

  return {
    // A translation record types every field as `string | string[]`.
    title: typeof titleText === 'string' ? titleText : titleText.join(' '),
    href: proposalReviewsHref({ ...route, profileId: proposal.profileId }),
    onOpen: openInSheet(proposal.profileId),
    submitterName: authors?.[0]?.name,
    displayCategories,
    status: getRowStatus({
      assignmentStatus: assignment.status,
      reviewState: review?.state,
    }),
    isOutOfDate: isReviewShownOutOfDate({
      isReviewOutOfDate,
      assignmentStatus: assignment.status,
    }),
    submittedAt:
      review?.state === ProposalReviewState.SUBMITTED && review.submittedAt
        ? new Date(review.submittedAt)
        : null,
  };
}

/** A draft review survives a revision round, so the round's status wins over it. */
function getRowStatus({
  assignmentStatus,
  reviewState,
}: {
  assignmentStatus: ProposalReviewAssignmentStatus;
  reviewState: ProposalReviewState | undefined;
}): AssignmentStatusValue {
  if (
    assignmentStatus ===
      ProposalReviewAssignmentStatus.AWAITING_AUTHOR_REVISION ||
    assignmentStatus === ProposalReviewAssignmentStatus.READY_FOR_RE_REVIEW
  ) {
    return assignmentStatus;
  }

  return reviewState ?? assignmentStatus;
}
