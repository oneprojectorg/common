import { ProposalReviewState } from '@op/db/schema';

/**
 * Whether a submitted review is out of date: the proposal has moved on since
 * the reviewer last reviewed it.
 *
 * The review's own `reviewedProposalHistoryId` is the anchor — the version its
 * content was last written against, re-stamped on every review write — so
 * staleness is "anchor ≠ the proposal's current history row". Any new history
 * row counts as a change; we compare row identity, not content.
 *
 * Reviews written before that column existed carry no anchor, so they fall back
 * to the assignment pin: the version the reviewer was asked to review, set at
 * assignment and re-anchored by a revision response. That is what the reviewer
 * saw unless the proposal changed between assignment and submission, and a
 * wrong fallback can only over-flag, which one re-affirm clears. There is no
 * backfill; the fallback is how those rows keep working.
 *
 * Only a SUBMITTED review can be out of date (there is nothing to be stale
 * before the reviewer commits an opinion). An unknown anchor, or a proposal
 * with no open history row, means we don't know what was reviewed, so we don't
 * claim staleness.
 */
export function isReviewOutOfDate({
  assignment,
  review,
  currentProposalHistoryId,
}: {
  assignment: { assignedProposalHistoryId: string | null };
  // Raw enum column infers as `string`.
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
