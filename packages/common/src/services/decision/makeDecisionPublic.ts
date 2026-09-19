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

/** Read the decision, submit a proposal, vote — what the runbook grants. */
const PUBLIC_DECISION_PERMISSION =
  permission.READ |
  decisionPermission.SUBMIT_PROPOSALS |
  decisionPermission.VOTE;

export interface MakeDecisionPublicResult {
  /** The decision's own profile, where the public grant is placed. */
  profileId: string;
}

/**
 * Opens a decision to the public: the sentinel member row, its link to the
 * global `Public` role, and a `decisions`-zone override scoped to this
 * decision's profile. The runbook this replaces wrote the same three rows by
 * hand. Idempotent, so a second click is a no-op.
 *
 * Every caller's grants resolve as their own ∪ the sentinel's
 * (`resolveAccessUserIds`), which is what makes one row reach visitors, anon
 * sessions and logged-in non-members alike. The `Public` role carries no global
 * permissions, so scoping the override to this profile is what keeps one public
 * decision from opening every other one.
 *
 * The grant belongs on the decision's profile and nowhere else: on a proposal's
 * profile it would surface every caller's drafts (`resolveProposalListScope`).
 *
 * Authorization lives in the calling procedure's platform-admin middleware.
 */
export const makeDecisionPublic = async ({
  instanceId,
}: {
  instanceId: string;
}): Promise<MakeDecisionPublicResult> => {
  const instance = await db.query.processInstances.findFirst({
    where: { id: instanceId },
    columns: { profileId: true },
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
    // The seeded global role the public sentinel holds; never profile-scoped.
    db.query.accessRoles.findFirst({
      where: { name: 'Public', profileId: { isNull: true } },
      columns: { id: true },
    }),
  ]);

  if (!zone) {
    throw new NotFoundError('Zone', 'decisions');
  }

  if (!publicRole) {
    throw new NotFoundError('Role', 'Public');
  }

  await db.transaction(async (tx) => {
    // `profileUsers` has no unique key on (profile, auth user), so the lock is
    // what keeps two admins clicking at once from writing two sentinel rows.
    const locked = await lockProcessInstance({ db: tx, instanceId });

    if (!locked) {
      throw new NotFoundError('Process instance', instanceId);
    }

    if (locked.status !== ProcessStatus.PUBLISHED) {
      throw new ValidationError(
        'Only a published decision can be opened to the public',
      );
    }

    let sentinel = await tx.query.profileUsers.findFirst({
      where: { profileId, authUserId: GLOBAL_USER_PUBLIC },
      columns: { id: true },
    });

    if (!sentinel) {
      [sentinel] = await tx
        .insert(profileUsers)
        .values({ profileId, authUserId: GLOBAL_USER_PUBLIC })
        .returning({ id: profileUsers.id });
    }

    if (!sentinel) {
      throw new CommonError('Failed to create the public member row');
    }

    await tx
      .insert(profileUserToAccessRoles)
      .values({ profileUserId: sentinel.id, accessRoleId: publicRole.id })
      .onConflictDoNothing();

    // Update, not do-nothing: an override written by hand may carry narrower
    // bits, and leaving those in place makes this a half-applied grant.
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

  await Promise.all([
    invalidateProfileUserCacheForProfile(profileId),
    invalidateDecisionInstance(instanceId),
  ]);

  logger.info('Decision opened to the public', { instanceId, profileId });

  return { profileId };
};
