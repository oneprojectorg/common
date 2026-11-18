import { db } from '@op/db/client';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../../utils';
import { assertProfileAccess } from '../../assert';
import { getProcessCategories } from '../getProcessCategories';
import { decisionPermission } from '../permissions';
import { categoryReviewerDataSchema } from '../schemas/categoryReviewerData';
import type {
  CategoryReviewerStatusSchema,
  CategoryWithReviewerStatusSchema,
} from '../schemas/reviews';

/**
 * Every category of the instance with its category reviewers for the current
 * phase and the develop confirm stamp of each. Category reviewers with no
 * phase do not count. A category with no category reviewer has
 * `reviewers: []`.
 *
 * Readers: an admin of the instance profile, or a holder of Develop Proposals
 * on it. No org fallback.
 */
export async function listCategoryReviewerStatus({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User;
}): Promise<CategoryWithReviewerStatusSchema[]> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: { profileId: true, currentStateId: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: [
      { profile: permission.ADMIN },
      { decisions: permission.ADMIN },
      { decisions: decisionPermission.DEVELOP_PROPOSALS },
    ],
  });

  const currentPhaseId = instance.currentStateId;

  const [categories, categoryReviewers] = await Promise.all([
    getProcessCategories({ processInstanceId, user }),
    currentPhaseId
      ? db.query.categoryReviewers.findMany({
          where: { processInstanceId, phaseId: currentPhaseId },
          columns: {
            id: true,
            taxonomyTermId: true,
            reviewerProfileId: true,
            data: true,
          },
          with: {
            reviewer: {
              columns: { id: true, name: true, slug: true },
              with: { avatarImage: { columns: { id: true, name: true } } },
            },
          },
          orderBy: { createdAt: 'asc', id: 'asc' },
        })
      : [],
  ]);

  const reviewersByTermId = new Map<string, CategoryReviewerStatusSchema[]>();
  for (const categoryReviewer of categoryReviewers) {
    const bucket = reviewersByTermId.get(categoryReviewer.taxonomyTermId) ?? [];
    bucket.push({
      reviewerProfileId: categoryReviewer.reviewerProfileId,
      developConfirmedAt: parseDevelopConfirmedAt({
        categoryReviewerId: categoryReviewer.id,
        data: categoryReviewer.data,
      }),
      profile: {
        id: categoryReviewer.reviewer.id,
        name: categoryReviewer.reviewer.name,
        slug: categoryReviewer.reviewer.slug,
        avatarImage: categoryReviewer.reviewer.avatarImage ?? null,
      },
    });
    reviewersByTermId.set(categoryReviewer.taxonomyTermId, bucket);
  }

  return categories.map((category) => ({
    category,
    reviewers: reviewersByTermId.get(category.id) ?? [],
  }));
}

function parseDevelopConfirmedAt({
  categoryReviewerId,
  data,
}: {
  categoryReviewerId: string;
  data: unknown;
}): string | null {
  if (!categoryReviewerDataSchema.validate(data)) {
    logger.warn('Category reviewer data does not match its schema', {
      categoryReviewerId,
    });
    return null;
  }

  return data.developConfirmedAt ?? null;
}
