import { db } from '@op/db/client';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getProfileAccessRoles } from '../access';
import { getProcessCategories } from './getProcessCategories';
import type { ProcessCategory } from './getProcessCategories';
import { decisionPermission } from './permissions';
import { categoryReviewerDataSchema } from './schemas/categoryReviewerData';

export interface CategoryDevelopmentRow {
  reviewerProfileId: string;
  developConfirmedAt: string | null;
}

export interface CategoryDevelopmentStatus {
  category: ProcessCategory;
  rows: CategoryDevelopmentRow[];
}

/**
 * Every category of the instance with its category reviewer rows for the
 * current phase and the develop confirm stamp of each row. Rows with no phase
 * do not count. A category with no row has `rows: []`.
 */
export async function listCategoryDevelopmentStatus({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User;
}): Promise<CategoryDevelopmentStatus[]> {
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

  const roles = await getProfileAccessRoles({
    user,
    profileId: instance.profileId,
  });

  if (
    !checkPermission(
      [
        { profile: permission.ADMIN },
        { decisions: permission.ADMIN },
        { decisions: decisionPermission.REVIEW },
      ],
      roles,
    )
  ) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const currentPhaseId = instance.currentStateId;

  const [categories, rows] = await Promise.all([
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
          orderBy: { createdAt: 'asc', id: 'asc' },
        })
      : [],
  ]);

  const rowsByTermId = new Map<string, CategoryDevelopmentRow[]>();
  for (const row of rows) {
    const bucket = rowsByTermId.get(row.taxonomyTermId) ?? [];
    bucket.push({
      reviewerProfileId: row.reviewerProfileId,
      developConfirmedAt: parseDevelopConfirmedAt({
        rowId: row.id,
        data: row.data,
      }),
    });
    rowsByTermId.set(row.taxonomyTermId, bucket);
  }

  return categories.map((category) => ({
    category,
    rows: rowsByTermId.get(category.id) ?? [],
  }));
}

function parseDevelopConfirmedAt({
  rowId,
  data,
}: {
  rowId: string;
  data: unknown;
}): string | null {
  const parsed = categoryReviewerDataSchema.safeParse(data);

  if (!parsed.success) {
    logger.warn('Category reviewer data does not match its schema', {
      categoryReviewerId: rowId,
      issues: parsed.error.issues,
    });
    return null;
  }

  return parsed.data.developConfirmedAt ?? null;
}
