import { ProposalReviewState } from '@op/db/schema';

/**
 * The proposal version a review was written against. Reviews older than the
 * review pointer column carry only the assignment pin.
 */
export function resolveReviewedProposalHistoryId({
  review,
  assignment,
}: {
  review: { reviewedProposalHistoryId: string | null } | null;
  assignment: { assignedProposalHistoryId: string | null };
}): string | null {
  return (
    review?.reviewedProposalHistoryId ?? assignment.assignedProposalHistoryId
  );
}

/**
 * A submitted review is out of date when its version anchor is not the
 * proposal's current history row. An unknown side never claims staleness.
 */
export function isReviewOutOfDate({
  assignment,
  review,
  currentProposalHistoryId,
}: {
  assignment: { assignedProposalHistoryId: string | null };
  review: { state: string; reviewedProposalHistoryId: string | null } | null;
  currentProposalHistoryId: string | null | undefined;
}): boolean {
  if (review?.state !== ProposalReviewState.SUBMITTED) {
    return false;
  }

  const reviewedProposalHistoryId = resolveReviewedProposalHistoryId({
    review,
    assignment,
  });

  if (!reviewedProposalHistoryId || !currentProposalHistoryId) {
    return false;
  }

  return reviewedProposalHistoryId !== currentProposalHistoryId;
}
