import { db, eq } from '@op/db/client';
import { type ProfileInvite, profileInvites } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { NotFoundError } from '../../utils/error';
import { assertProfileAccess } from '../assert';

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
}): Promise<ProfileInvite> => {
  // Find the invite
  const invite = await db.query.profileInvites.findFirst({
    where: {
      id: inviteId,
      acceptedOn: { isNull: true },
    },
  });

  if (!invite) {
    throw new NotFoundError('Profile invite', inviteId);
  }

  // Check if user has ADMIN access on the profile
  await assertProfileAccess({
    user,
    profileId: invite.profileId,
    permissions: { profile: permission.ADMIN },
  });

  const [deleted] = await db
    .delete(profileInvites)
    .where(eq(profileInvites.id, inviteId))
    .returning();

  if (!deleted) {
    throw new NotFoundError('Profile invite', inviteId);
  }

  return deleted;
};
