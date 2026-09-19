import { GLOBAL_USER_PUBLIC } from '@op/core';
import { db } from '@op/db/client';
import {
  ProcessStatus,
  accessRolePermissionsOnAccessZones,
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

/** SUBMIT_PROPOSALS is what makes the header offer Join rather than Log in. */
const PUBLIC_DECISION_PERMISSION =
  permission.READ |
  decisionPermission.SUBMIT_PROPOSALS |
  decisionPermission.VOTE;

/**
 * Grants the global `Public` role on this decision's own profile. Idempotent.
 * Every caller's grants resolve as their own union the public sentinel's, so
 * one member row reaches visitors and logged-in non-members alike; the role
 * holds no global permissions, so the profile-scoped override is what stops
 * this grant opening every other decision.
 *
 * Authorization lives in the calling procedure's platform-admin middleware.
 */
export const makeDecisionPublic = async ({
  instanceId,
}: {
  instanceId: string;
}): Promise<{ profileId: string }> => {
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
    // No unique key on (profile, auth user), so the lock is what stops two
    // admins clicking at once from writing two sentinel rows.
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

    // Update, not do-nothing: a hand-written override may carry narrower bits.
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
  });

  await Promise.all([
    invalidateProfileUserCacheForProfile(profileId),
    invalidateDecisionInstance(instanceId),
  ]);

  logger.info('Decision opened to the public', { instanceId, profileId });

  return { profileId };
};
