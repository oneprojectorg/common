import { db, eq } from '@op/db/client';
import { profileUsers } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { getProfileUserWithRelations } from './getProfileUserWithRelations';

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
  // Fetch the profile user with full relations before deletion
  const profileUserWithRelations =
    await getProfileUserWithRelations(profileUserId);

  if (!profileUserWithRelations) {
    throw new NotFoundError('Member not found');
  }

  const targetProfileId = profileUserWithRelations.profileId;

  // Check if user has ADMIN access on the profile
  const currentProfileUser = await getProfileAccessUser({
    user,
    profileId: targetProfileId,
  });

  if (!currentProfileUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, currentProfileUser.roles ?? []);

  // Delete the profile user (this cascades to profileUserToAccessRoles)
  await db.delete(profileUsers).where(eq(profileUsers.id, profileUserId));

  // Return the deleted entity
  return profileUserWithRelations;
};
