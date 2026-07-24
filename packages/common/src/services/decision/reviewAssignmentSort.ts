/** The sort modes offered by the reviewer's "Proposals to review" list. */
export const REVIEW_ASSIGNMENT_SORTS = [
  'leastReviewed',
  'newest',
  'oldest',
] as const;

export type ReviewAssignmentSort = (typeof REVIEW_ASSIGNMENT_SORTS)[number];
