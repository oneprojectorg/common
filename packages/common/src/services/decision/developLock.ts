import { type DbClient, type SQL, and, db, eq, sql } from '@op/db/client';
import { categoryReviewers, users } from '@op/db/schema';
import { checkPermission, permission } from 'access-zones';

import { ConflictError, ValidationError } from '../../utils';
import { type AccessUser, getProfileAccessRoles } from '../access';
import { isDevelopWindowOpen } from './isDevelopWindowOpen';
import type { PhaseRules } from './schemas/types';
import { isDevelopPhase } from './utils/phaseSettings';

type DevelopLockInstance = Parameters<
  typeof isDevelopWindowOpen
>[0]['instance'] & {
  profileId: string | null;
  phases: readonly { phaseId: string; rules?: PhaseRules }[];
};

/** Why the caller may not develop now: the window is closed, or they confirmed their work. */
export type DevelopLock = 'windowClosed' | 'confirmed';

/**
 * The develop lock of the caller, or `null` when they may develop:
 * 1. The develop window must be open, for everyone, admins included.
 * 2. See {@link isLockedByDevelopConfirm}.
 */
export async function getDevelopLock({
  instance,
  user,
}: {
  instance: DevelopLockInstance;
  user: AccessUser | undefined;
}): Promise<DevelopLock | null> {
  if (!(await isDevelopWindowOpen({ instance }))) {
    return 'windowClosed';
  }

  if (await isLockedByDevelopConfirm({ instance, user })) {
    return 'confirmed';
  }

  return null;
}

/** Asserts {@link getDevelopLock} finds no lock. */
export async function assertDevelopUnlocked({
  instance,
  user,
}: {
  instance: DevelopLockInstance;
  user: AccessUser;
}): Promise<void> {
  const lock = await getDevelopLock({ instance, user });

  if (lock === 'windowClosed') {
    throw new ValidationError('Development is closed for this phase');
  }

  if (lock === 'confirmed') {
    throw developConfirmedError();
  }
}

/** The refusal for a caller who confirmed their work. */
function developConfirmedError(): ConflictError {
  return new ConflictError(
    'You confirmed your work. Unconfirm it to make changes',
  );
}

/**
 * In a develop phase, a caller who is not an admin of the instance profile is
 * locked when they have at least one category reviewer row for the phase and
 * every one of those rows is confirmed. A caller with no row is not locked.
 */
async function isLockedByDevelopConfirm({
  instance,
  user,
}: {
  instance: DevelopLockInstance;
  user: AccessUser | undefined;
}): Promise<boolean> {
  const currentPhase = instance.phases.find(
    (phase) => phase.phaseId === instance.currentStateId,
  );

  if (
    !user ||
    !instance.profileId ||
    !currentPhase ||
    !isDevelopPhase(currentPhase)
  ) {
    return false;
  }

  const roles = await getProfileAccessRoles({
    user: { id: user.id },
    profileId: instance.profileId,
  });

  if (
    checkPermission(
      [{ profile: permission.ADMIN }, { decisions: permission.ADMIN }],
      roles,
    )
  ) {
    return false;
  }

  return hasConfirmedEveryOwnCategory({
    processInstanceId: instance.id,
    phaseId: currentPhase.phaseId,
    authUserId: user.id,
  });
}

// `decision_category_reviewers` is a temporary store of who owns a category;
// keep its read in this function so it is easy to swap.
async function hasConfirmedEveryOwnCategory({
  processInstanceId,
  phaseId,
  authUserId,
}: {
  processInstanceId: string;
  phaseId: string;
  authUserId: string;
}): Promise<boolean> {
  // `bool_and` is NULL when the caller has no row for the phase.
  const [result] = await db
    .select({
      allConfirmed: sql<
        boolean | null
      >`bool_and(${isCategoryReviewerDevelopConfirmed()})`,
    })
    .from(categoryReviewers)
    .innerJoin(users, eq(users.profileId, categoryReviewers.reviewerProfileId))
    .where(
      and(
        eq(users.authUserId, authUserId),
        eq(categoryReviewers.processInstanceId, processInstanceId),
        eq(categoryReviewers.phaseId, phaseId),
      ),
    );

  return result?.allConfirmed === true;
}

// `decision_category_reviewers` is a temporary store of who owns a category.
// True when the phase has at least one row and every row is confirmed.
export async function isEveryCategoryDevelopConfirmed({
  processInstanceId,
  phaseId,
  dbClient = db,
}: {
  processInstanceId: string;
  phaseId: string;
  dbClient?: DbClient;
}): Promise<boolean> {
  // `bool_and` is NULL when the phase has no row.
  const [result] = await dbClient
    .select({
      allConfirmed: sql<
        boolean | null
      >`bool_and(${isCategoryReviewerDevelopConfirmed()})`,
    })
    .from(categoryReviewers)
    .where(
      and(
        eq(categoryReviewers.processInstanceId, processInstanceId),
        eq(categoryReviewers.phaseId, phaseId),
      ),
    );

  return result?.allConfirmed === true;
}

/** True for a category reviewer row whose develop work is confirmed. */
export function isCategoryReviewerDevelopConfirmed(): SQL<boolean> {
  return sql<boolean>`${categoryReviewers.data} ->> 'developConfirmedAt' IS NOT NULL`;
}
