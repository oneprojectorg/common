/** The sort modes offered by the reviewer's "Proposals to review" list. */
export const REVIEW_ASSIGNMENT_SORTS = [
  'leastReviewed',
  'newest',
  'oldest',
] as const;

export type ReviewAssignmentSort = (typeof REVIEW_ASSIGNMENT_SORTS)[number];

/** One assignment's inputs to the "Least reviewed" ordering. */
export interface LeastReviewedSortItem {
  /** Proposal id — seeds the stable, reviewer-scoped random tiebreak. */
  proposalId: string;
  /** Total COMPLETED reviews for this proposal across all reviewers. */
  completedReviewCount: number;
  /**
   * Priority of the reviewer's own assignment status — lower sorts first, so
   * the most actionable work (resume in-progress, then items needing action)
   * surfaces ahead of not-started and completed within a review-count bucket.
   */
  statusRank: number;
}

/**
 * Deterministic pseudo-random score in [0, 1) derived from a string (FNV-1a).
 * Stable so a reviewer sees a consistent order across refetches, while a
 * different reviewer (different seed) gets a different order — spreading review
 * coverage across the pool without a persisted shuffle.
 */
export function stableRandomScore(seed: string): number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // >>> 0 coerces to an unsigned 32-bit int before normalising to [0, 1).
  return (hash >>> 0) / 4294967296;
}

/**
 * Orders review assignments by the "Least reviewed" hierarchy from the review
 * queue design:
 *   1. fewest completed reviews across all reviewers (ascending), so
 *      under-reviewed proposals surface first;
 *   2. the reviewer's status priority (ascending `statusRank`), so the most
 *      actionable items lead within a review-count bucket;
 *   3. a stable per-reviewer random tiebreak, so proposals with equal coverage
 *      appear in a different order for each reviewer and coverage spreads out.
 *
 * Returns a new, sorted array; the input is not mutated.
 */
export function sortByLeastReviewed<T extends LeastReviewedSortItem>(
  items: T[],
  reviewerProfileId: string,
): T[] {
  return [...items].sort((a, b) => {
    if (a.completedReviewCount !== b.completedReviewCount) {
      return a.completedReviewCount - b.completedReviewCount;
    }

    if (a.statusRank !== b.statusRank) {
      return a.statusRank - b.statusRank;
    }

    return (
      stableRandomScore(`${reviewerProfileId}:${a.proposalId}`) -
      stableRandomScore(`${reviewerProfileId}:${b.proposalId}`)
    );
  });
}
