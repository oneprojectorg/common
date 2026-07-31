import { and, db, eq, isNull } from '@op/db/client';
import { categoryReviewers } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { assertCategoryReviewerAdmin } from './categoryReviewerHelpers';
import { reconcileReviewAssignments } from './reconcileReviewAssignments';

/**
 * Removes a reviewer from a category's scope (admin-gated), idempotent (no
 * match reports `removed: false`). The scope row is deleted, then the
 * reconciler prunes this category's now-unjustified `pending` assignments
 * (§3 — non-pending assignments are kept). `phaseId` omitted = instance-wide.
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
  user: User;
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

  const removed = deleted.length > 0;

  // Only reconcile when a scope row actually went away: prune the pending
  // assignments this category no longer justifies. A no-op unless the instance
  // is in a live by_category review phase.
  if (removed) {
    await reconcileReviewAssignments({
      instanceId: processInstanceId,
      affected: { taxonomyTermId },
    });
  }

  return { removed };
}
