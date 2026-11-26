import {
  type DbClient,
  type SQL,
  and,
  count,
  db,
  eq,
  exists,
  isNull,
  sql,
} from '@op/db/client';
import {
  ProposalRelationshipType,
  ProposalStatus,
  categoryReviewers,
  proposalCategories,
  proposalRelationships,
  proposals,
  users,
} from '@op/db/schema';
import { checkPermission, permission } from 'access-zones';

import { ConflictError, ValidationError } from '../../utils';
import { type AccessUser, getProfileAccessRoles } from '../access';
import { isDevelopWindowOpen } from './isDevelopWindowOpen';
import { activeProposalPredicate } from './phaseEligibility';
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
      >`bool_and(${isCategoryReviewerDevelopConfirmed(categoryReviewers)})`,
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
      >`bool_and(${isCategoryReviewerDevelopConfirmed(categoryReviewers)})`,
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

/** The entries `publishDevelopedProposals` publishes, grouped by category. */
export async function countAdvancingByCategory({
  processInstanceId,
}: {
  processInstanceId: string;
}): Promise<Map<string, number>> {
  const rows = await db
    .select({
      taxonomyTermId: proposalCategories.taxonomyTermId,
      total: count(),
    })
    .from(proposals)
    .innerJoin(
      proposalCategories,
      eq(proposalCategories.proposalId, proposals.id),
    )
    .where(
      and(
        eq(proposals.processInstanceId, processInstanceId),
        eq(proposals.status, ProposalStatus.SUBMITTED),
        activeProposalPredicate(proposals),
        exists(
          db
            .select({ id: proposalRelationships.id })
            .from(proposalRelationships)
            .where(
              and(
                eq(proposalRelationships.processInstanceId, processInstanceId),
                eq(proposalRelationships.targetProposalId, proposals.id),
                eq(
                  proposalRelationships.relationshipType,
                  ProposalRelationshipType.DEVELOPED,
                ),
                isNull(proposalRelationships.deletedAt),
              ),
            ),
        ),
      ),
    )
    .groupBy(proposalCategories.taxonomyTermId);

  return new Map(rows.map((row) => [row.taxonomyTermId, row.total]));
}

export function isCategoryReviewerDevelopConfirmed(
  table: typeof categoryReviewers,
): SQL<boolean> {
  return sql<boolean>`${table.data} ->> 'developConfirmedAt' IS NOT NULL`;
}
