import { GLOBAL_USER_PUBLIC } from '@op/core';
import { and, db, eq, inArray } from '@op/db/client';
import { profileUserToAccessRoles, profileUsers, users } from '@op/db/schema';
import { logger } from '@op/logging';

import {
  pickEffectivePermissionRows,
  zonePermissionsWhere,
} from '../access/utils';

/**
 * Personal profile ids of every member of the decision profile holding a role
 * with any of the given decisions-zone permission bits. `includesPublic` is
 * true when the public grant holds one of the bits, which extends it to
 * every caller; the public sentinel itself is not in `profileIds`.
 *
 * Permission rows are profile-scoped: global rows (profileId IS NULL) are the
 * baseline, and a row scoped to the decision profile overrides them.
 */
export async function getProfileIdsWithDecisionPermission({
  decisionProfileId,
  permission,
}: {
  decisionProfileId: string;
  permission: number;
}): Promise<{ profileIds: string[]; includesPublic: boolean }> {
  const decisionsZone = await db.query.accessZones.findFirst({
    where: { name: 'decisions' },
  });

  if (!decisionsZone) {
    logger.error(
      'getProfileIdsWithDecisionPermission: decisions access zone not found',
    );
    return { profileIds: [], includesPublic: false };
  }

  const zonePermissionRows =
    await db.query.accessRolePermissionsOnAccessZones.findMany({
      where: {
        accessZoneId: decisionsZone.id,
        ...zonePermissionsWhere(decisionProfileId),
        accessRole: {
          OR: [
            { profileId: { isNull: true } },
            { profileId: decisionProfileId },
          ],
        },
      },
      columns: { accessRoleId: true, permission: true, profileId: true },
    });

  const roleIds = pickEffectivePermissionRows(
    zonePermissionRows,
    (row) => row.accessRoleId,
    decisionProfileId,
  )
    .filter((row) => (row.permission & permission) !== 0)
    .map((row) => row.accessRoleId);

  if (roleIds.length === 0) {
    return { profileIds: [], includesPublic: false };
  }

  // profileUsers (decision membership)
  //   → profileUserToAccessRoles (role assignments)
  //   → users (personal profileId)
  const rows = await db
    .selectDistinct({
      authUserId: profileUsers.authUserId,
      profileId: users.profileId,
    })
    .from(profileUsers)
    .innerJoin(users, eq(profileUsers.authUserId, users.authUserId))
    .innerJoin(
      profileUserToAccessRoles,
      eq(profileUsers.id, profileUserToAccessRoles.profileUserId),
    )
    .where(
      and(
        eq(profileUsers.profileId, decisionProfileId),
        inArray(profileUserToAccessRoles.accessRoleId, roleIds),
      ),
    );

  return {
    profileIds: rows
      .filter((row) => row.authUserId !== GLOBAL_USER_PUBLIC)
      .map((row) => row.profileId)
      .filter((id): id is string => id != null),
    includesPublic: rows.some((row) => row.authUserId === GLOBAL_USER_PUBLIC),
  };
}
