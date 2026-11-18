import type { CategoryWithReviewerStatusSchema } from '@op/common/client';

export function countConfirmedReviewers(
  reviewers: CategoryWithReviewerStatusSchema['reviewers'],
): number {
  return reviewers.reduce(
    (count, reviewer) =>
      reviewer.developConfirmedAt === null ? count : count + 1,
    0,
  );
}

export function isCategoryConfirmed(
  status: CategoryWithReviewerStatusSchema,
): boolean {
  return (
    status.reviewers.length > 0 &&
    countConfirmedReviewers(status.reviewers) === status.reviewers.length
  );
}
