import { GLOBAL_USER_PUBLIC } from '@op/core';
import { and, db, eq, inArray, ne } from '@op/db/client';
import { profileUserToAccessRoles, profileUsers, users } from '@op/db/schema';

import {
  pickEffectivePermissionRows,
  zonePermissionsWhere,
} from '../access/utils';

/**
 * Personal profile ids of every member of the decision profile holding a role
 * with any of the given decisions-zone permission bits. The public sentinel is
 * not a person, so it is left out; `isDecisionPublic` answers for it.
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
}): Promise<string[]> {
  const zonePermissionRows =
    await db.query.accessRolePermissionsOnAccessZones.findMany({
      where: {
        accessZone: { name: 'decisions' },
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
    return [];
  }

  // profileUsers (decision membership)
  //   → profileUserToAccessRoles (role assignments)
  //   → users (personal profileId)
  const rows = await db
    .selectDistinct({ profileId: users.profileId })
    .from(profileUsers)
    .innerJoin(users, eq(profileUsers.authUserId, users.authUserId))
    .innerJoin(
      profileUserToAccessRoles,
      eq(profileUsers.id, profileUserToAccessRoles.profileUserId),
    )
    .where(
      and(
        eq(profileUsers.profileId, decisionProfileId),
        ne(profileUsers.authUserId, GLOBAL_USER_PUBLIC),
        inArray(profileUserToAccessRoles.accessRoleId, roleIds),
      ),
    );

  return rows.map((r) => r.profileId).filter((id): id is string => id != null);
}
