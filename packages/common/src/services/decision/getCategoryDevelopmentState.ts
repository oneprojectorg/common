import { and, db, eq } from '@op/db/client';
import {
  ProcessStatus,
  categoryReviewers,
  taxonomyTerms,
  users,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { assertProfileAccess } from '../assert';
import { type DevelopLock, getDevelopLock } from './developLock';
import { getPhases } from './instancePhases';
import { decisionPermission } from './permissions';
import { isDevelopPhase } from './utils/phaseSettings';

export interface CategoryDevelopmentState {
  /**
   * The caller may confirm or unconfirm their own develop work: they are not
   * an admin, the current phase is a develop phase of a published instance,
   * and they have at least one category reviewer row for it.
   */
  canConfirm: boolean;
  /** {@link getDevelopLock} for the caller. */
  lock: DevelopLock | null;
  /** The labels of the caller's categories for the current phase, by label. */
  categoryNames: string[];
}

/**
 * What the develop screen needs to know about the caller's own develop work
 * in the current phase. Readers: an admin of the instance profile, or a
 * holder of Develop Proposals on it. No org fallback.
 */
export async function getCategoryDevelopmentState({
  processInstanceId,
  user,
}: {
  processInstanceId: string;
  user: User;
}): Promise<CategoryDevelopmentState> {
  const instance = await db.query.processInstances.findFirst({
    where: { id: processInstanceId },
    columns: {
      id: true,
      profileId: true,
      status: true,
      currentStateId: true,
      instanceData: true,
    },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', processInstanceId);
  }

  if (!instance.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const [phases, roles] = await Promise.all([
    getPhases({ instance }),
    assertProfileAccess({
      user,
      profileId: instance.profileId,
      permissions: [
        { profile: permission.ADMIN },
        { decisions: permission.ADMIN },
        { decisions: decisionPermission.DEVELOP_PROPOSALS },
      ],
    }),
  ]);

  const isAdmin = checkPermission(
    [{ profile: permission.ADMIN }, { decisions: permission.ADMIN }],
    roles,
  );

  const currentPhase = phases.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );

  const [lock, categoryNames] = await Promise.all([
    getDevelopLock({ instance: { ...instance, phases }, user }),
    currentPhase
      ? listOwnCategoryNames({
          processInstanceId,
          phaseId: currentPhase.phaseId,
          authUserId: user.id,
        })
      : [],
  ]);

  const canConfirm =
    !isAdmin &&
    instance.status === ProcessStatus.PUBLISHED &&
    !!currentPhase &&
    isDevelopPhase(currentPhase) &&
    categoryNames.length > 0;

  return { canConfirm, lock, categoryNames };
}

// `decision_category_reviewers` is a temporary store of who owns a category;
// keep its read in this function so it is easy to swap.
async function listOwnCategoryNames({
  processInstanceId,
  phaseId,
  authUserId,
}: {
  processInstanceId: string;
  phaseId: string;
  authUserId: string;
}): Promise<string[]> {
  const rows = await db
    .selectDistinct({ label: taxonomyTerms.label })
    .from(categoryReviewers)
    .innerJoin(users, eq(users.profileId, categoryReviewers.reviewerProfileId))
    .innerJoin(
      taxonomyTerms,
      eq(taxonomyTerms.id, categoryReviewers.taxonomyTermId),
    )
    .where(
      and(
        eq(users.authUserId, authUserId),
        eq(categoryReviewers.processInstanceId, processInstanceId),
        eq(categoryReviewers.phaseId, phaseId),
      ),
    )
    .orderBy(taxonomyTerms.label);

  return rows.map((row) => row.label);
}
