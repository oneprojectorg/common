import { and, db, eq, inArray } from '@op/db/client';
import { profileUserToAccessRoles, profileUsers, users } from '@op/db/schema';
import { logger } from '@op/logging';

import {
  pickEffectivePermissionRows,
  zonePermissionsWhere,
} from '../access/utils';
import { decisionPermission } from './permissions';

/**
 * Personal profile ids of every member currently holding the REVIEW
 * capability on the given decision profile. Shared by generation and backfill
 * so both resolve eligibility identically.
 *
 * Permission rows are profile-scoped: global rows (profileId IS NULL) are the
 * baseline, and a row scoped to the decision profile overrides them.
 */
export async function getEligibleReviewerProfileIds({
  decisionProfileId,
}: {
  decisionProfileId: string;
}): Promise<string[]> {
  const decisionsZone = await db.query.accessZones.findFirst({
    where: { name: 'decisions' },
  });

  if (!decisionsZone) {
    logger.error(
      'getEligibleReviewerProfileIds: decisions access zone not found',
    );
    return [];
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

  const reviewRoleIds = pickEffectivePermissionRows(
    zonePermissionRows,
    (row) => row.accessRoleId,
    decisionProfileId,
  )
    .filter((row) => (row.permission & decisionPermission.REVIEW) !== 0)
    .map((row) => row.accessRoleId);

  if (reviewRoleIds.length === 0) {
    return [];
  }

  // profileUsers (decision membership)
  //   → profileUserToAccessRoles (role assignments)
  //   → users (personal profileId)
  // Filtered to members holding a role with the REVIEW capability.
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
        inArray(profileUserToAccessRoles.accessRoleId, reviewRoleIds),
      ),
    );

  return rows.map((r) => r.profileId).filter((id): id is string => id != null);
}
