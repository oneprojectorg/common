import { invalidate } from '@op/cache';
import { db, eq } from '@op/db/client';
import { profileUsers } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError, ValidationError } from '../../utils/error';
import { getProfileAccessUser, getUserSession } from '../access';
import { assertProfileAccess, assertProfileUser } from '../assert';

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
  const targetProfileUser = await assertProfileUser(profileUserId);

  // Check if user has ADMIN access on the profile
  await assertProfileAccess(
    { user, profileId: targetProfileUser.profileId },
    { profile: permission.ADMIN },
  );

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

  await Promise.all([
    invalidate({
      type: 'profileUser',
      params: [deletedUser.profileId, deletedUser.authUserId],
    }),
    invalidate({
      type: 'user',
      params: [deletedUser.authUserId],
    }),
  ]);
  getProfileAccessUser.invalidate({
    user: { id: deletedUser.authUserId },
    profileId: deletedUser.profileId,
  });
  getUserSession.invalidate({ authUserId: deletedUser.authUserId });

  return deletedUser;
};
