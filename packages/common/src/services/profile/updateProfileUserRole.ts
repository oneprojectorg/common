import { db, eq } from '@op/db/client';
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
 * Update a profile member's role
 */
export const updateProfileUserRole = async ({
  profileUserId,
  roleId,
  user,
}: {
  profileUserId: string;
  roleId: string;
  user: User;
}) => {
  const [targetProfileUser, targetRole] = await Promise.all([
    db.query.profileUsers.findFirst({
      where: eq(profileUsers.id, profileUserId),
    }),
    db.query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.id, roleId),
    }),
  ]);

  if (!targetProfileUser) {
    throw new NotFoundError('Member not found');
  }

  if (!targetRole) {
    throw new CommonError('Invalid role specified');
  }

  const profileId = targetProfileUser.profileId;

  const currentProfileUser = await getProfileAccessUser({
    user,
    profileId,
  });

  if (!currentProfileUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, currentProfileUser.roles ?? []);

  // Update the role in a transaction
  await db.transaction(async (tx) => {
    // Remove all existing roles for this profile user
    await tx
      .delete(profileUserToAccessRoles)
      .where(eq(profileUserToAccessRoles.profileUserId, profileUserId));

    // Add the new role
    await tx.insert(profileUserToAccessRoles).values({
      profileUserId,
      accessRoleId: targetRole.id,
    });
  });

  return { success: true };
};
