import type { CategoryWithReviewerStatusSchema } from '@op/common/client';

/** How many of a category's reviewers carry the develop confirm stamp. */
export function countConfirmedReviewers(
  reviewers: CategoryWithReviewerStatusSchema['reviewers'],
): number {
  return reviewers.reduce(
    (count, reviewer) =>
      reviewer.developConfirmedAt === null ? count : count + 1,
    0,
  );
}

/** A category is confirmed when it has reviewers and every one is stamped. */
export function isCategoryConfirmed(
  status: CategoryWithReviewerStatusSchema,
): boolean {
  return (
    status.reviewers.length > 0 &&
    countConfirmedReviewers(status.reviewers) === status.reviewers.length
  );
}
