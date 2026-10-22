import { GLOBAL_USER_PUBLIC } from '@op/core';
import { and, db, eq } from '@op/db/client';
import {
  accessRolePermissionsOnAccessZones,
  profileUsers,
} from '@op/db/schema';
import { logger } from '@op/logging';

import { invalidateProfileUserCacheForProfile } from '../access/permissions';
import { invalidateDecisionInstance } from './decisionCache';
import { lockProcessInstanceOrThrow } from './lockProcessInstance';
import { resolvePublicGrantTarget } from './resolvePublicGrantTarget';

/**
 * Closes a decision the public could read. Deleting the sentinel member row is
 * what revokes access — its role link cascades — but the profile-scoped
 * override does not, so it goes too rather than being left claiming the
 * decision grants the public something. Idempotent.
 *
 * Members keep their own grants, including anyone who joined while it was open.
 *
 * Authorization lives in the calling procedure's platform-admin middleware.
 */
export const removeDecisionPublicAccess = async ({
  instanceId,
}: {
  instanceId: string;
}): Promise<{ profileId: string }> => {
  const { profileId, zoneId, publicRoleId } = await resolvePublicGrantTarget({
    instanceId,
  });

  await db.transaction(async (tx) => {
    // Same lock the grant takes, so the two can't interleave into a profile
    // that holds an override with no member row behind it.
    await lockProcessInstanceOrThrow({ db: tx, instanceId });

    await tx
      .delete(profileUsers)
      .where(
        and(
          eq(profileUsers.profileId, profileId),
          eq(profileUsers.authUserId, GLOBAL_USER_PUBLIC),
        ),
      );

    // Scoped to the Public role, mirroring the write: other global roles can
    // carry their own per-profile override on this zone.
    await tx
      .delete(accessRolePermissionsOnAccessZones)
      .where(
        and(
          eq(accessRolePermissionsOnAccessZones.accessRoleId, publicRoleId),
          eq(accessRolePermissionsOnAccessZones.accessZoneId, zoneId),
          eq(accessRolePermissionsOnAccessZones.profileId, profileId),
        ),
      );
  });

  await Promise.all([
    invalidateProfileUserCacheForProfile(profileId),
    invalidateDecisionInstance(instanceId),
  ]);

  logger.info('Public access removed from decision', { instanceId, profileId });

  return { profileId };
};
