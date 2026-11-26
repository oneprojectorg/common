import { db, sql } from '@op/db/client';
import { categoryReviewers } from '@op/db/schema';
import { Events } from '@op/events';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';

import { NotFoundError } from '../../../utils';
import { sendCategoryAssignmentEvents } from '../events/sendCategoryAssignmentEvents';
import type { CategoryDevelopmentReviewerSchema } from '../schemas/reviews';
import {
  assertCategoryDevelopAccess,
  categoryDevelopRowsWhere,
} from './assertCategoryDevelopAccess';

/**
 * Removes `data.developConfirmedAt` from category reviewer rows for the
 * current develop phase, on the same rows that `confirmCategoryDevelopment`
 * stamps.
 */
export async function unconfirmCategoryDevelopment({
  processInstanceId,
  taxonomyTermId,
  reviewerProfileId,
  user,
}: {
  processInstanceId: string;
  taxonomyTermId?: string;
  reviewerProfileId?: string;
  user: User;
}): Promise<{ reviewers: CategoryDevelopmentReviewerSchema[] }> {
  const access = await assertCategoryDevelopAccess({
    processInstanceId,
    taxonomyTermId,
    reviewerProfileId,
    user,
  });

  const updated = await db
    .update(categoryReviewers)
    .set({ data: sql`${categoryReviewers.data} - 'developConfirmedAt'` })
    .where(categoryDevelopRowsWhere({ processInstanceId, access }))
    .returning({
      reviewerProfileId: categoryReviewers.reviewerProfileId,
      taxonomyTermId: categoryReviewers.taxonomyTermId,
    });

  if (updated.length === 0) {
    throw new NotFoundError(
      'Category reviewers',
      taxonomyTermId ?? processInstanceId,
      'No category reviewer to unconfirm for the current phase',
    );
  }

  sendCategoryAssignmentEvents({
    name: Events.categoryDevelopmentUnconfirmed.name,
    processInstanceId,
    phaseId: access.phaseId,
    assignments: updated,
  });

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
    reviewers: updated.map(({ reviewerProfileId }) => ({
      reviewerProfileId,
      developConfirmedAt: null,
    })),
  };
}
