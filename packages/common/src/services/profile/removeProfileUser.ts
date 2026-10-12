import { db, eq } from '@op/db/client';
import { EntityType, profileUsers } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils/error';
import { invalidateProfileUserAccessCache } from '../access';
import { assertProfileAdmin } from '../assert';
import { emitDecisionMemberRolesChanged } from '../decision/events/emitDecisionMemberRolesChanged';

/**
 * Remove a member from a profile
 */
export const removeProfileUser = async ({
  profileUserId,
  user,
}: {
  profileUserId: string;
  user: User;
}) => {
  // Roles are read before the delete, which cascades them away.
  const targetProfileUser = await db.query.profileUsers.findFirst({
    where: { id: profileUserId },
    with: {
      roles: { columns: { accessRoleId: true } },
      profile: { columns: { type: true } },
    },
  });

  if (!targetProfileUser) {
    throw new NotFoundError('Profile user', profileUserId);
  }

  // Check if user has ADMIN access on the profile
  await assertProfileAdmin({ user, profileId: targetProfileUser.profileId });

  if (targetProfileUser.isOwner) {
    throw new ValidationError('Cannot remove the owner of a profile');
  }

  // Delete the profile user (this cascades to profileUserToAccessRoles)
  const [deletedUser] = await db
    .delete(profileUsers)
    .where(eq(profileUsers.id, profileUserId))
    .returning();

  if (!deletedUser) {
    throw new NotFoundError('Profile user', profileUserId);
  }

  if (targetProfileUser.profile.type === EntityType.DECISION) {
    emitDecisionMemberRolesChanged({
      decisionProfileId: deletedUser.profileId,
      authUserId: deletedUser.authUserId,
      addedRoleIds: [],
      removedRoleIds: targetProfileUser.roles.map((role) => role.accessRoleId),
    });
  }

  await invalidateProfileUserAccessCache({
    authUserId: deletedUser.authUserId,
    profileId: deletedUser.profileId,
  });

  return deletedUser;
};
