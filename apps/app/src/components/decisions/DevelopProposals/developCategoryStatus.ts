import type { CategoryWithReviewerStatusSchema } from '@op/common/client';

/**
 * The latest confirm stamp once every category reviewer row of the category
 * confirmed. Null while one is open, and for a category with no row.
 */
export function getCategoryConfirmedAt({
  reviewers,
}: CategoryWithReviewerStatusSchema): string | null {
  let latest: string | null = null;
  for (const { developConfirmedAt } of reviewers) {
    if (developConfirmedAt === null) {
      return null;
    }
    if (
      latest === null ||
      Date.parse(developConfirmedAt) > Date.parse(latest)
    ) {
      latest = developConfirmedAt;
    }
  }
  return latest;
}
