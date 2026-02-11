import { db, eq } from '@op/db/client';
import { profileInvites } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';

/**
 * Delete a pending profile invite.
 * Only admins of the profile can delete invites.
 */
export const deleteProfileInvite = async ({
  inviteId,
  user,
}: {
  inviteId: string;
  user: User;
}) => {
  // Find the invite
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

  const [deleted] = await db
    .delete(profileInvites)
    .where(eq(profileInvites.id, inviteId))
    .returning();

  if (!deleted) {
    throw new NotFoundError('Failed to delete invite');
  }

  return deleted;
};
