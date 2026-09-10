import { ProposalReviewState } from '@op/db/schema';

/**
 * A submitted review is out of date when its version anchor is not the
 * proposal's current history row. Reviews written before the anchor column
 * existed fall back to the assignment pin (no backfill). An unknown side never
 * claims staleness.
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

  const reviewedProposalHistoryId =
    review.reviewedProposalHistoryId ?? assignment.assignedProposalHistoryId;

  if (!reviewedProposalHistoryId || !currentProposalHistoryId) {
    return false;
  }

  return reviewedProposalHistoryId !== currentProposalHistoryId;
}
