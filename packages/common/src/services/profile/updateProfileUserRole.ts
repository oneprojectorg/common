import { invalidate } from '@op/cache';
import { and, db, eq, inArray } from '@op/db/client';
import { EntityType, profileUserToAccessRoles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { checkPermission, permission } from 'access-zones';

import { CommonError, NotFoundError, ValidationError } from '../../utils/error';
import {
  assignableRoleFilter,
  getNormalizedRoles,
  getProfileAccessUser,
  getUserSession,
  profileUserCacheKey,
} from '../access';
import { assertProfileAdmin } from '../assert';
import { emitDecisionMemberRolesChanged } from '../decision/events/emitDecisionMemberRolesChanged';
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
        // Gates the decision-scoped role-change event below.
        profile: { columns: { type: true } },
      },
    }),
    // Non-assignable system global roles resolve as nonexistent and fail the
    // invalid-role check below.
    db.query.accessRoles.findMany({
      where: {
        id: { in: roleIdsDeduped },
        RAW: (table) => assignableRoleFilter(table),
      },
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

  await assertProfileAdmin({ user, profileId: targetProfileId });

  if (targetProfileUser.isOwner) {
    // Profile owners must always retain admin access on their own profile —
    // the UI lets an owner switch themselves to a non-admin role and locks
    // them out, so we enforce it server-side. Load the desired roles with
    // their zone permissions and verify the union still grants profile ADMIN.
    const requestedRolesWithPermissions = await db.query.accessRoles.findMany({
      where: { id: { in: roleIdsDeduped } },
      with: {
        zonePermissions: {
          with: { accessZone: true },
        },
      },
    });

    const normalizedDesired = getNormalizedRoles(
      requestedRolesWithPermissions.map((accessRole) => ({ accessRole })),
      { profileId: targetProfileId },
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

    if (targetProfileUser.profile.type === EntityType.DECISION) {
      emitDecisionMemberRolesChanged({
        decisionProfileId: targetProfileId,
        authUserId: targetProfileUser.authUserId,
        addedRoleIds: rolesToAdd,
        removedRoleIds: rolesToRemove,
      });
    }
  }

  await Promise.all([
    invalidate({
      type: 'profileUser',
      params: profileUserCacheKey({
        user: { id: targetProfileUser.authUserId },
        profileId: targetProfileId,
      }),
    }),
    invalidate({
      type: 'user',
      params: [targetProfileUser.authUserId],
    }),
  ]);
  getProfileAccessUser.invalidate({
    user: { id: targetProfileUser.authUserId },
    profileId: targetProfileId,
  });
  getUserSession.invalidate({ authUserId: targetProfileUser.authUserId });

  // Fetch and return the updated profile user with full relations
  const updatedProfileUser = await getProfileUserWithRelations(profileUserId);
  if (!updatedProfileUser) {
    throw new CommonError('Failed to fetch updated profile user');
  }

  return updatedProfileUser;
};
