import { invalidate } from '@op/cache';
import { and, db, eq, inArray } from '@op/db/client';
import { profileUserToAccessRoles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, checkPermission, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/error';
import { getNormalizedRoles, getProfileAccessUser } from '../access';
import { getProfileUserWithRelations } from './getProfileUserWithRelations';

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

  const roleIdsDeduped = [...new Set(roleIds)];

  const [targetProfileUser, validRoles] = await Promise.all([
    db.query.profileUsers.findFirst({
      where: { id: profileUserId },
      with: {
        roles: true,
      },
    }),
    db.query.accessRoles.findMany({
      where: { id: { in: roleIdsDeduped } },
    }),
  ]);

  if (!targetProfileUser) {
    throw new NotFoundError('Profile user', profileUserId);
  }

  if (validRoles.length !== roleIdsDeduped.length) {
    const validRoleIds = new Set(validRoles.map((r) => r.id));
    const invalidRoleIds = roleIdsDeduped.filter((id) => !validRoleIds.has(id));
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

  if (targetProfileUser.isOwner) {
    // Profile owners must always retain admin access on their own profile —
    // the UI lets an owner switch themselves to a non-admin role and locks
    // them out, so we enforce it server-side. Load the desired roles with
    // their zone permissions and verify the union still grants profile ADMIN.
    const desiredRolesWithPermissions = await db.query.accessRoles.findMany({
      where: { id: { in: roleIdsDeduped } },
      with: {
        zonePermissions: {
          with: { accessZone: true },
        },
      },
    });

    const normalizedDesired = getNormalizedRoles(
      desiredRolesWithPermissions.map((accessRole) => ({ accessRole })),
    );

    if (!checkPermission({ profile: permission.ADMIN }, normalizedDesired)) {
      throw new ValidationError(
        'Cannot remove admin access from the owner of a profile',
      );
    }
  }

  const existingRoleIds = new Set(
    targetProfileUser.roles.map((r) => r.accessRoleId),
  );
  const desiredRoleIds = new Set(roleIdsDeduped);

  const rolesToAdd = roleIdsDeduped.filter((id) => !existingRoleIds.has(id));
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

  await Promise.all([
    invalidate({
      type: 'profileUser',
      params: [targetProfileId, targetProfileUser.authUserId],
    }),
    invalidate({
      type: 'user',
      params: [targetProfileUser.authUserId],
    }),
  ]);

  // Fetch and return the updated profile user with full relations
  const updatedProfileUser = await getProfileUserWithRelations(profileUserId);
  if (!updatedProfileUser) {
    throw new CommonError('Failed to fetch updated profile user');
  }

  return updatedProfileUser;
};
