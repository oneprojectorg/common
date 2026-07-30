import { db } from '@op/db/client';
import { type CategoryReviewer, categoryReviewers } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import { assertCategoryReviewerAdmin } from './categoryReviewerHelpers';

/**
 * Adds a reviewer to a category's scope (admin-gated), idempotent via ON
 * CONFLICT DO NOTHING. No eligibility check — dangling scope rows are
 * deliberately tolerated (Decision 7). `phaseId` omitted = instance-wide.
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
  user: User | undefined;
}): Promise<CategoryReviewer> {
  await assertCategoryReviewerAdmin({ processInstanceId, user });

  await db
    .insert(categoryReviewers)
    .values({
      processInstanceId,
      taxonomyTermId,
      reviewerProfileId,
      phaseId: phaseId ?? null,
    })
    .onConflictDoNothing();

  const row = await db.query.categoryReviewers.findFirst({
    where: {
      processInstanceId,
      taxonomyTermId,
      reviewerProfileId,
      phaseId: phaseId ?? { isNull: true },
    },
  });

  if (!row) {
    // Only reachable if the row was removed concurrently between the two statements.
    throw new NotFoundError('Category reviewer could not be resolved');
  }

  return row;
}
