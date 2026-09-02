import { db, eq } from '@op/db/client';
import { profileUsers } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { NotFoundError, ValidationError } from '../../utils/error';
import { invalidateProfileUserAccessCache } from '../access';
import { assertProfileAdmin, assertProfileUser } from '../assert';

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

  await invalidateProfileUserAccessCache({
    authUserId: deletedUser.authUserId,
    profileId: deletedUser.profileId,
  });

  return deletedUser;
};
