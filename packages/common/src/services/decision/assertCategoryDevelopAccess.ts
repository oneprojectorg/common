import { type SQL, and, db, eq, exists } from '@op/db/client';
import {
  ProcessStatus,
  categoryReviewers,
  processInstances,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError, ValidationError } from '../../utils';
import { getProfileAccessRoles } from '../access';
import { assertUserByAuthId } from '../assert';
import { decisionPermission } from './permissions';
import { getInstancePhases } from './schemas/instanceData';
import { isDevelopPhase } from './utils/phaseSettings';

export interface CategoryDevelopAccess {
  phaseId: string;
  actorProfileId: string;
  isAdmin: boolean;
  /** The one reviewer row to act on; `null` = every row of the category. */
  targetReviewerProfileId: string | null;
}

/**
 * Asserts the caller may confirm or unconfirm the develop work of a category
 * in the current phase, which must be a develop phase of a published
 * instance. An admin of the instance profile (no org fallback) acts on the
 * row of `reviewerProfileId`, or on every row of the category for the phase
 * when it is not given. Anyone else needs Develop Proposals on the instance
 * profile and their own row for the phase, and acts on that row only. Review
 * does not count.
 *
 * The rule is not final: the server gates of the develop procedures are
 * still open and will change it.
 */
export async function assertCategoryDevelopAccess({
  processInstanceId,
  taxonomyTermId,
  reviewerProfileId,
  user,
}: {
  processInstanceId: string;
  taxonomyTermId: string;
  reviewerProfileId?: string;
  user: User;
}): Promise<CategoryDevelopAccess> {
  const [instance, dbUser] = await Promise.all([
    db.query.processInstances.findFirst({
      where: { id: processInstanceId },
      columns: {
        profileId: true,
        status: true,
        currentStateId: true,
        instanceData: true,
      },
    }),
    assertUserByAuthId(user.id),
  ]);

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  const currentPhase = getInstancePhases(instance.instanceData).find(
    (phase) => phase.phaseId === instance.currentStateId,
  );

  if (
    instance.status !== ProcessStatus.PUBLISHED ||
    !currentPhase ||
    !isDevelopPhase(currentPhase)
  ) {
    throw new ValidationError(
      'Category development can only be confirmed in a develop phase',
    );
  }

  if (!instance.profileId || !dbUser.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const roles = await getProfileAccessRoles({
    user,
    profileId: instance.profileId,
  });
  const phaseId = currentPhase.phaseId;

  if (
    checkPermission(
      [{ profile: permission.ADMIN }, { decisions: permission.ADMIN }],
      roles,
    )
  ) {
    return {
      phaseId,
      actorProfileId: dbUser.profileId,
      isAdmin: true,
      targetReviewerProfileId: reviewerProfileId ?? null,
    };
  }

  if (
    !checkPermission({ decisions: decisionPermission.DEVELOP_PROPOSALS }, roles)
  ) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  if (reviewerProfileId && reviewerProfileId !== dbUser.profileId) {
    throw new UnauthorizedError(
      'You can only confirm or unconfirm your own category reviewer row',
    );
  }

  // Rows with no phase scope reviewing only and do not count here.
  const ownRow = await db.query.categoryReviewers.findFirst({
    where: {
      processInstanceId,
      taxonomyTermId,
      reviewerProfileId: dbUser.profileId,
      phaseId,
    },
    columns: { id: true },
  });

  if (!ownRow) {
    throw new UnauthorizedError(
      'You are not a reviewer of this category for the current phase',
    );
  }

  return {
    phaseId,
    actorProfileId: dbUser.profileId,
    isAdmin: false,
    targetReviewerProfileId: dbUser.profileId,
  };
}

/**
 * The rows a confirm or unconfirm writes. It checks the phase again in the
 * same statement, so a write after the phase moved on changes no row.
 */
export function categoryDevelopRowsWhere({
  processInstanceId,
  taxonomyTermId,
  access,
}: {
  processInstanceId: string;
  taxonomyTermId: string;
  access: CategoryDevelopAccess;
}): SQL | undefined {
  return and(
    eq(categoryReviewers.processInstanceId, processInstanceId),
    eq(categoryReviewers.taxonomyTermId, taxonomyTermId),
    eq(categoryReviewers.phaseId, access.phaseId),
    access.targetReviewerProfileId
      ? eq(categoryReviewers.reviewerProfileId, access.targetReviewerProfileId)
      : undefined,
    exists(
      db
        .select({ id: processInstances.id })
        .from(processInstances)
        .where(
          and(
            eq(processInstances.id, processInstanceId),
            eq(processInstances.status, ProcessStatus.PUBLISHED),
            eq(processInstances.currentStateId, access.phaseId),
          ),
        ),
    ),
  );
}
