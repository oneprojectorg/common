import { db } from '@op/db/client';
import { type CategoryReviewer, categoryReviewers } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { assertCategoryReviewerAdmin } from './categoryReviewerHelpers';
import { reconcileReviewAssignments } from './reconcileReviewAssignments';

/**
 * Adds a reviewer to a category's scope (admin-gated), idempotent via ON
 * CONFLICT. Dangling scope rows are tolerated (no eligibility check).
 */
export async function addCategoryReviewer({
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
}): Promise<CategoryReviewer> {
  await assertCategoryReviewerAdmin({ processInstanceId, user });

  const [inserted] = await db
    .insert(categoryReviewers)
    .values({
      processInstanceId,
      taxonomyTermId,
      reviewerProfileId,
      phaseId: phaseId ?? null,
    })
    .onConflictDoNothing()
    .returning();

  // On conflict RETURNING is empty (DO NOTHING), so re-select the pre-existing
  // row to stay idempotent.
  const row =
    inserted ??
    (await db.query.categoryReviewers.findFirst({
      where: {
        processInstanceId,
        taxonomyTermId,
        reviewerProfileId,
        phaseId: phaseId ?? { isNull: true },
      },
    }));

  if (!row) {
    // Only reachable if the row was removed concurrently between the two statements.
    throw new NotFoundError('Category reviewer could not be resolved');
  }

  // Mid-phase add: immediately create the newly-justified assignments for this
  // category's in-phase proposals (add-only — the reconcile prunes nothing on
  // an add). Runs on both the fresh-insert and already-present paths so a
  // first-time scope add backfills. A no-op unless the instance is in a live
  // by_category review phase.
  await reconcileReviewAssignments({
    instanceId: processInstanceId,
    affected: { taxonomyTermId },
  });

  return row;
}
