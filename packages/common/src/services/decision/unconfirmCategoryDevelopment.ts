import { db, sql } from '@op/db/client';
import { categoryReviewers } from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../utils';
import {
  assertCategoryDevelopAccess,
  categoryDevelopRowsWhere,
} from './assertCategoryDevelopAccess';
import type { CategoryDevelopmentRow } from './listCategoryDevelopmentStatus';

/**
 * Removes `data.developConfirmedAt` from the category reviewer rows of a
 * category for the current develop phase: the caller's own row, or every row
 * when the caller is an admin and names no reviewer.
 */
export async function unconfirmCategoryDevelopment({
  processInstanceId,
  taxonomyTermId,
  reviewerProfileId,
  user,
}: {
  processInstanceId: string;
  taxonomyTermId: string;
  reviewerProfileId?: string;
  user: User;
}): Promise<{ rows: CategoryDevelopmentRow[] }> {
  const access = await assertCategoryDevelopAccess({
    processInstanceId,
    taxonomyTermId,
    reviewerProfileId,
    user,
  });

  // TODO(PUB-SERVICE): refuse an unconfirm after publish, once publish writes
  // its stamp.
  const updated = await db
    .update(categoryReviewers)
    .set({ data: sql`${categoryReviewers.data} - 'developConfirmedAt'` })
    .where(
      categoryDevelopRowsWhere({ processInstanceId, taxonomyTermId, access }),
    )
    .returning({ reviewerProfileId: categoryReviewers.reviewerProfileId });

  if (updated.length === 0) {
    throw new NotFoundError(
      'Category reviewer rows',
      taxonomyTermId,
      'No category reviewer row to unconfirm for the current phase',
    );
  }

  if (access.isAdmin) {
    logger.info('Admin unconfirmed category development', {
      processInstanceId,
      taxonomyTermId,
      phaseId: access.phaseId,
      actorProfileId: access.actorProfileId,
      targetReviewerProfileId: access.targetReviewerProfileId,
      rowCount: updated.length,
    });
  }

  return {
    rows: updated.map(({ reviewerProfileId }) => ({
      reviewerProfileId,
      developConfirmedAt: null,
    })),
  };
}
