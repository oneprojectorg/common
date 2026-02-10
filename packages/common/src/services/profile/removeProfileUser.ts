import { db, eq } from '@op/db/client';
import { profileUsers } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import {
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfileUser } from '../assert';

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
  const currentProfileUser = await getProfileAccessUser({
    user,
    profileId: targetProfileUser.profileId,
  });

  if (!currentProfileUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, currentProfileUser.roles ?? []);

  if (targetProfileUser.isOwner) {
    throw new ValidationError('Cannot remove the owner of a profile');
  }

  // Delete the profile user (this cascades to profileUserToAccessRoles)
  const [deletedUser] = await db
    .delete(profileUsers)
    .where(eq(profileUsers.id, profileUserId))
    .returning();

  if (!deletedUser) {
    throw new NotFoundError('Failed to delete profile user');
  }

  return deletedUser;
};
