import { type SQL, and, db, desc, eq, exists, isNull } from '@op/db/client';
import {
  ProcessStatus,
  categoryReviewers,
  processInstances,
  stateTransitionHistory,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';
import { alias } from 'drizzle-orm/pg-core';

import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../utils';
import { assertProfileAccess, assertUserByAuthId } from '../../assert';
import { getPhases } from '../instancePhases';
import { isDevelopWindowOpen } from '../isDevelopWindowOpen';
import { decisionPermission } from '../permissions';
import { isDevelopPhase } from '../utils/phaseSettings';

export type CategoryDevelopAccess = {
  phaseId: string;
  actorProfileId: string;
} & (
  | {
      isAdmin: true;
      taxonomyTermId: string;
      /** The one reviewer row to act on; `null` = every row of the category. */
      targetReviewerProfileId: string | null;
    }
  | {
      isAdmin: false;
      /** `null` = every own row for the phase. */
      taxonomyTermId: string | null;
      targetReviewerProfileId: string;
    }
);

/**
 * Asserts the caller may confirm or unconfirm develop work in the current
 * phase, which must be a develop phase of a published instance with the
 * develop window open (`isDevelopWindowOpen`), for admins too. An admin of
 * the instance profile (no org fallback) must name a category, and acts on
 * the row of `reviewerProfileId`, or on every row of the category for the
 * phase when it is not given. Anyone else needs Develop Proposals on the
 * instance profile and at least one own row for the phase, and acts on their
 * own row of the category, or on all their own rows for the phase when no
 * category is given. Review does not count.
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
  taxonomyTermId?: string;
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

  if (!instance.profileId || !dbUser.profileId) {
    throw new UnauthorizedError("You don't have access to do this");
  }

  const roles = await assertProfileAccess({
    user,
    profileId: instance.profileId,
    permissions: [
      { profile: permission.ADMIN },
      { decisions: permission.ADMIN },
      { decisions: decisionPermission.DEVELOP_PROPOSALS },
    ],
  });

  const phases = await getPhases({
    instance: { id: processInstanceId, instanceData: instance.instanceData },
  });
  const currentPhase = phases.find(
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

  // Closed once the selections of the phase are confirmed (publish), for
  // admins too.
  if (
    !(await isDevelopWindowOpen({
      instance: {
        id: processInstanceId,
        instanceData: instance.instanceData,
        currentStateId: instance.currentStateId,
        phases,
      },
    }))
  ) {
    throw new ValidationError('Development is closed for this phase');
  }

  const phaseId = currentPhase.phaseId;

  if (
    checkPermission(
      [{ profile: permission.ADMIN }, { decisions: permission.ADMIN }],
      roles,
    )
  ) {
    // An admin acts for others, one category at a time.
    if (!taxonomyTermId) {
      throw new ValidationError('Choose a category to confirm or unconfirm');
    }

    return {
      phaseId,
      actorProfileId: dbUser.profileId,
      isAdmin: true,
      taxonomyTermId,
      targetReviewerProfileId: reviewerProfileId ?? null,
    };
  }

  if (reviewerProfileId && reviewerProfileId !== dbUser.profileId) {
    throw new UnauthorizedError(
      'You can only confirm or unconfirm for yourself',
    );
  }

  // Rows with no phase scope reviewing only and do not count here.
  const ownRow = await db.query.categoryReviewers.findFirst({
    where: {
      processInstanceId,
      reviewerProfileId: dbUser.profileId,
      phaseId,
      ...(taxonomyTermId ? { taxonomyTermId } : {}),
    },
    columns: { id: true },
  });

  if (!ownRow) {
    throw new UnauthorizedError(
      taxonomyTermId
        ? 'You are not a reviewer of this category for the current phase'
        : 'You are not a reviewer of any category for the current phase',
    );
  }

  return {
    phaseId,
    actorProfileId: dbUser.profileId,
    isAdmin: false,
    taxonomyTermId: taxonomyTermId ?? null,
    targetReviewerProfileId: dbUser.profileId,
  };
}

/**
 * The rows a confirm or unconfirm writes: the rows of one category, or every
 * own row of a non-admin caller when no category is given. It checks the
 * phase and the develop window again in the same statement, so a write after
 * the phase moved on or after publish changes no row.
 */
export function categoryDevelopRowsWhere({
  processInstanceId,
  access,
}: {
  processInstanceId: string;
  access: CategoryDevelopAccess;
}): SQL | undefined {
  return and(
    eq(categoryReviewers.processInstanceId, processInstanceId),
    access.taxonomyTermId
      ? eq(categoryReviewers.taxonomyTermId, access.taxonomyTermId)
      : undefined,
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
    developWindowOpenWhere({ processInstanceId, phaseId: access.phaseId }),
  );
}

/**
 * The SQL twin of `isDevelopWindowOpen` once the phase is known to be a
 * develop phase: the latest transition of the instance goes into `phaseId`
 * and either holds a pipeline selection for approval, or carries no
 * `manualSelection` stamp and has no proposal attached.
 */
function developWindowOpenWhere({
  processInstanceId,
  phaseId,
}: {
  processInstanceId: string;
  phaseId: string;
}): SQL {
  const latestTransition = alias(stateTransitionHistory, 'latest_transition');
  const latestTransitionId = db
    .select({ id: stateTransitionHistory.id })
    .from(stateTransitionHistory)
    .where(eq(stateTransitionHistory.processInstanceId, processInstanceId))
    .orderBy(desc(stateTransitionHistory.transitionedAt))
    .limit(1);

  return exists(
    db
      .select({ id: latestTransition.id })
      .from(latestTransition)
      .where(
        and(
          eq(latestTransition.id, latestTransitionId),
          eq(latestTransition.toStateId, phaseId),
          isNull(latestTransition.selectionConfirmedAt),
        ),
      ),
  );
}
