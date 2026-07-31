import { and, db, eq, isNull } from '@op/db/client';
import { categoryReviewers } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { assertCategoryReviewerAdmin } from './categoryReviewerHelpers';

/**
 * Removes a reviewer from a category's scope (admin-gated), idempotent (no
 * match reports `removed: false`). Only the scope row is touched.
 */
export async function removeCategoryReviewer({
  processInstanceId,
  taxonomyTermId,
  reviewerProfileId,
  phaseId,
  user,
}: {
  processInstanceId: string;
  taxonomyTermId: string;
  reviewerProfileId: string;
  phaseId?: string;
  user: User | undefined;
}): Promise<{ removed: boolean }> {
  await assertCategoryReviewerAdmin({ processInstanceId, user });

  const deleted = await db
    .delete(categoryReviewers)
    .where(
      and(
        eq(categoryReviewers.processInstanceId, processInstanceId),
        eq(categoryReviewers.taxonomyTermId, taxonomyTermId),
        eq(categoryReviewers.reviewerProfileId, reviewerProfileId),
        phaseId === undefined
          ? isNull(categoryReviewers.phaseId)
          : eq(categoryReviewers.phaseId, phaseId),
      ),
    )
    .returning({ id: categoryReviewers.id });

  return { removed: deleted.length > 0 };
}
