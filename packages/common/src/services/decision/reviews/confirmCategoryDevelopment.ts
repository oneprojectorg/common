import { db, sql } from '@op/db/client';
import { categoryReviewers } from '@op/db/schema';
import { Events, event } from '@op/events';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';

import { NotFoundError } from '../../../utils';
import type { CategoryDevelopmentReviewerSchema } from '../schemas/reviews';
import {
  assertCategoryDevelopAccess,
  categoryDevelopRowsWhere,
} from './assertCategoryDevelopAccess';

/**
 * Stamps `data.developConfirmedAt` on category reviewer rows for the current
 * develop phase. A non-admin stamps their own row of the category, or all
 * their own rows when no category is given. An admin names a category and
 * stamps one reviewer's row, or every row of the category when no reviewer is
 * given. A second confirm overwrites the time.
 */
export async function confirmCategoryDevelopment({
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
  const now = new Date().toISOString();

  // One statement that merges the key, so two confirms at the same time do
  // not overwrite each other's rows.
  const updated = await db
    .update(categoryReviewers)
    .set({
      data: sql`${categoryReviewers.data} || ${JSON.stringify({ developConfirmedAt: now })}::jsonb`,
    })
    .where(categoryDevelopRowsWhere({ processInstanceId, access }))
    .returning({
      reviewerProfileId: categoryReviewers.reviewerProfileId,
      taxonomyTermId: categoryReviewers.taxonomyTermId,
    });

  if (updated.length === 0) {
    throw new NotFoundError(
      'Category reviewers',
      taxonomyTermId ?? processInstanceId,
      'No category reviewer to confirm for the current phase',
    );
  }

  sendCategoryDevelopmentConfirmed({
    processInstanceId,
    phaseId: access.phaseId,
    taxonomyTermIds: [...new Set(updated.map((row) => row.taxonomyTermId))],
  });

  if (access.isAdmin) {
    logger.info('Admin confirmed category development', {
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
      developConfirmedAt: now,
    })),
  };
}

/**
 * Sends one `categoryDevelopmentConfirmed` per category after a confirm
 * stamped rows of those categories. Never throws; a failure is logged.
 */
function sendCategoryDevelopmentConfirmed({
  processInstanceId,
  phaseId,
  taxonomyTermIds,
}: {
  processInstanceId: string;
  phaseId: string;
  taxonomyTermIds: ReadonlyArray<string>;
}): void {
  try {
    waitUntil(
      event
        .send(
          taxonomyTermIds.map((taxonomyTermId) => ({
            name: Events.categoryDevelopmentConfirmed.name,
            data: { processInstanceId, phaseId, taxonomyTermId },
          })),
        )
        .catch((error) => {
          logger.error('Failed to send category development confirmed event', {
            processInstanceId,
            error,
          });
        }),
    );
  } catch (error) {
    // waitUntil can throw synchronously off-Vercel (no request context).
    logger.error('Failed to schedule category development confirmed event', {
      processInstanceId,
      error,
    });
  }
}
