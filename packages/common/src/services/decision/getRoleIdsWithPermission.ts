import { type DbClient, db } from '@op/db/client';

import {
  pickEffectivePermissionRows,
  zonePermissionsWhere,
} from '../access/utils';

/**
 * Ids of the roles usable on the profile whose effective permission in any of
 * the zones holds any of the given bits. Permission rows are profile-scoped:
 * global rows (profileId IS NULL) are the baseline, and a row scoped to the
 * profile overrides them.
 */
export async function getRoleIdsWithPermission({
  profileId,
  zoneNames,
  permission,
  dbClient = db,
}: {
  profileId: string;
  zoneNames: Array<'profile' | 'decisions'>;
  permission: number;
  dbClient?: DbClient;
}): Promise<string[]> {
  const zonePermissionRows =
    await dbClient.query.accessRolePermissionsOnAccessZones.findMany({
      where: {
        accessZone: { name: { in: zoneNames } },
        ...zonePermissionsWhere(profileId),
        accessRole: {
          OR: [{ profileId: { isNull: true } }, { profileId }],
        },
      },
      columns: {
        accessRoleId: true,
        accessZoneId: true,
        permission: true,
        profileId: true,
      },
    });

  const roleIds = pickEffectivePermissionRows(
    zonePermissionRows,
    (row) => `${row.accessRoleId}:${row.accessZoneId}`,
    profileId,
  )
    .filter((row) => (row.permission & permission) !== 0)
    .map((row) => row.accessRoleId);

  return [...new Set(roleIds)];
}
