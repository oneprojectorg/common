import { db, eq } from '@op/db/client';
import { type ProfileInvite, profileInvites } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';

/**
 * Update a pending profile invite's role.
 * Only admins of the profile can update invites.
 */
export const updateProfileInvite = async ({
  inviteId,
  accessRoleId,
  user,
}: {
  inviteId: string;
  accessRoleId: string;
  user: User;
}): Promise<ProfileInvite> => {
  // Find the invite (must be pending)
  const invite = await db.query.profileInvites.findFirst({
    where: {
      id: inviteId,
      acceptedOn: { isNull: true },
    },
  });

  if (!invite) {
    throw new NotFoundError('Invite not found');
  }

  // Check if user has ADMIN access on the profile
  const profileAccessUser = await getProfileAccessUser({
    user,
    profileId: invite.profileId,
  });

  if (!profileAccessUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, profileAccessUser.roles ?? []);

  // Validate the new role exists
  const role = await db.query.accessRoles.findFirst({
    where: { id: accessRoleId },
  });

  if (!role) {
    throw new CommonError('Invalid role specified');
  }

  // Update the invite
  const [updated] = await db
    .update(profileInvites)
    .set({ accessRoleId })
    .where(eq(profileInvites.id, inviteId))
    .returning();

  if (!updated) {
    throw new CommonError('Failed to update invite');
  }

  return updated;
};
