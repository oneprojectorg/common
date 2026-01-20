import { and, db, eq, inArray } from '@op/db/client';
import { profileUserToAccessRoles, profileUsers } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/error';
import { getProfileAccessUser } from '../access';

/**
 * Update a profile member's roles by syncing to the provided roleIds.
 * Roles not in the array will be removed, roles in the array will be added if missing.
 */
export const updateProfileUserRoles = async ({
  profileUserId,
  roleIds,
  user,
}: {
  profileUserId: string;
  roleIds: string[];
  user: User;
}) => {
  if (roleIds.length === 0) {
    throw new CommonError('At least one role must be specified');
  }

  const [targetProfileUser, validRoles] = await Promise.all([
    db._query.profileUsers.findFirst({
      where: eq(profileUsers.id, profileUserId),
      with: {
        roles: true,
      },
    }),
    db._query.accessRoles.findMany({
      where: (table, { inArray }) => inArray(table.id, roleIds),
    }),
  ]);

  if (!targetProfileUser) {
    throw new NotFoundError('Member not found');
  }

  if (validRoles.length !== roleIds.length) {
    const validRoleIds = new Set(validRoles.map((r) => r.id));
    const invalidRoleIds = roleIds.filter((id) => !validRoleIds.has(id));
    throw new CommonError(
      `Invalid role(s) specified: ${invalidRoleIds.join(', ')}`,
    );
  }

  const targetProfileId = targetProfileUser.profileId;

  const currentProfileUser = await getProfileAccessUser({
    user,
    profileId: targetProfileId,
  });

  if (!currentProfileUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, currentProfileUser.roles ?? []);

  const existingRoleIds = new Set(
    targetProfileUser.roles.map((r) => r.accessRoleId),
  );
  const desiredRoleIds = new Set(roleIds);

  const rolesToAdd = roleIds.filter((id) => !existingRoleIds.has(id));
  const rolesToRemove = targetProfileUser.roles
    .filter((r) => !desiredRoleIds.has(r.accessRoleId))
    .map((r) => r.accessRoleId);

  // Only perform database operations if there are changes
  if (rolesToAdd.length > 0 || rolesToRemove.length > 0) {
    await db.transaction(async (tx) => {
      if (rolesToRemove.length > 0) {
        await tx
          .delete(profileUserToAccessRoles)
          .where(
            and(
              eq(profileUserToAccessRoles.profileUserId, profileUserId),
              inArray(profileUserToAccessRoles.accessRoleId, rolesToRemove),
            ),
          );
      }

      if (rolesToAdd.length > 0) {
        await tx.insert(profileUserToAccessRoles).values(
          rolesToAdd.map((accessRoleId) => ({
            profileUserId,
            accessRoleId,
          })),
        );
      }
    });
  }

  return { success: true };
};
