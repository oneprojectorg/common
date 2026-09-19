import { GLOBAL_USER_PUBLIC } from '@op/core';
import { db, eq } from '@op/db/client';
import {
  ProcessStatus,
  accessRolePermissionsOnAccessZones,
  processInstances,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import { logger } from '@op/logging';
import { permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { invalidateProfileUserCacheForProfile } from '../access/permissions';
import { invalidateDecisionInstance } from './decisionCache';
import { lockProcessInstance } from './lockProcessInstance';
import { decisionPermission } from './permissions';
import type { DecisionInstanceData } from './schemas/instanceData';

/**
 * What the public grant admits on the decisions zone: read the decision, submit
 * a proposal, and vote. The same bitfield the manual runbook has always
 * written, so a decision opened from the admin screen behaves like one opened
 * by hand.
 */
export const PUBLIC_DECISION_PERMISSION =
  permission.READ |
  decisionPermission.SUBMIT_PROPOSALS |
  decisionPermission.VOTE;

/** The seeded global role the public sentinel holds. Never profile-scoped. */
const PUBLIC_ROLE_NAME = 'Public';

export interface MakeDecisionPublicResult {
  /** The decision's own profile, where the public grant is placed. */
  profileId: string;
  /** Always true on success — the decision is open when this returns. */
  isPublic: true;
}

/**
 * Open a decision process to the public — the platform-admin counterpart of the
 * manual "make a process public" runbook. Authorization lives in the calling
 * procedure's platform-admin middleware; there is deliberately no user-facing
 * equivalent.
 *
 * Three writes, in one transaction, all idempotent so a second click is a no-op:
 *
 * 1. A `profileUsers` row for the {@link GLOBAL_USER_PUBLIC} sentinel on the
 *    decision's own profile. Every caller's grants resolve as "their own ∪ the
 *    public sentinel's" (see `resolveAccessUserIds`), so this row is what makes
 *    the decision reachable by members, logged-in non-members, anonymous
 *    sessions, and no-JWT visitors alike.
 * 2. The sentinel's link to the global `Public` role. That role carries no
 *    global permissions of its own, so the link alone opens nothing.
 * 3. A per-profile override row granting the `Public` role
 *    {@link PUBLIC_DECISION_PERMISSION} on the `decisions` zone, scoped to this
 *    profile. Scoping is what keeps one public decision from opening every
 *    other one.
 *
 * `instanceData.config.isPrivate` is cleared alongside the grant: it drives the
 * product's public badge, and a decision anyone can read must not still present
 * itself as private.
 *
 * The public grant belongs on the decision's profile and nowhere else — a
 * public grant on an individual proposal's profile would surface every caller's
 * drafts and hidden proposals (see `resolveProposalListScope`).
 */
export const makeDecisionPublic = async ({
  instanceId,
}: {
  instanceId: string;
}): Promise<MakeDecisionPublicResult> => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { id: true, profileId: true },
  });

  if (!instance) {
    throw new NotFoundError('Process instance', instanceId);
  }

  const { profileId } = instance;

  if (!profileId) {
    throw new ValidationError(
      'This decision has no profile of its own, so it cannot be opened to the public',
    );
  }

  const [zone, publicRole] = await Promise.all([
    db.query.accessZones.findFirst({ where: { name: 'decisions' } }),
    db.query.accessRoles.findFirst({
      where: { name: PUBLIC_ROLE_NAME, profileId: { isNull: true } },
      columns: { id: true },
    }),
  ]);

  if (!zone) {
    throw new NotFoundError('Zone', 'decisions');
  }

  if (!publicRole) {
    throw new NotFoundError('Role', PUBLIC_ROLE_NAME);
  }

  await db.transaction(async (tx) => {
    // `profileUsers` carries no unique key on (profile, auth user), so the
    // lock — not an ON CONFLICT clause — is what stops two admins clicking at
    // once from leaving the decision with two public sentinel rows.
    const locked = await lockProcessInstance({ db: tx, instanceId });

    if (!locked) {
      throw new NotFoundError('Process instance', instanceId);
    }

    if (locked.status !== ProcessStatus.PUBLISHED) {
      throw new ValidationError(
        'Only a published decision can be opened to the public',
      );
    }

    const existingSentinel = await tx.query.profileUsers.findFirst({
      where: { profileId, authUserId: GLOBAL_USER_PUBLIC },
      columns: { id: true },
    });

    const sentinelId =
      existingSentinel?.id ??
      (
        await tx
          .insert(profileUsers)
          .values({ profileId, authUserId: GLOBAL_USER_PUBLIC })
          .returning({ id: profileUsers.id })
      )[0]?.id;

    if (!sentinelId) {
      throw new CommonError('Failed to create the public member row');
    }

    await tx
      .insert(profileUserToAccessRoles)
      .values({ profileUserId: sentinelId, accessRoleId: publicRole.id })
      .onConflictDoNothing();

    // An override row may already exist with narrower bits (a decision opened
    // read-only by hand); widen it rather than leaving the grant half-applied.
    await tx
      .insert(accessRolePermissionsOnAccessZones)
      .values({
        accessRoleId: publicRole.id,
        accessZoneId: zone.id,
        permission: PUBLIC_DECISION_PERMISSION,
        profileId,
      })
      .onConflictDoUpdate({
        target: [
          accessRolePermissionsOnAccessZones.accessRoleId,
          accessRolePermissionsOnAccessZones.accessZoneId,
          accessRolePermissionsOnAccessZones.profileId,
        ],
        set: { permission: PUBLIC_DECISION_PERMISSION },
      });

    const instanceData = locked.instanceData as DecisionInstanceData | null;

    if (instanceData?.config?.isPrivate) {
      await tx
        .update(processInstances)
        .set({
          instanceData: {
            ...instanceData,
            config: { ...instanceData.config, isPrivate: false },
          },
        })
        .where(eq(processInstances.id, instanceId));
    }
  });

  // The grant widens who can read the decision, so both the access records on
  // the profile and every cached projection of the instance are now stale.
  await Promise.all([
    invalidateProfileUserCacheForProfile(profileId),
    invalidateDecisionInstance(instanceId),
  ]);

  logger.info('Decision opened to the public', { instanceId, profileId });

  return { profileId, isPublic: true };
};
