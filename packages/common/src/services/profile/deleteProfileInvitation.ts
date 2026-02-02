import { db, eq } from '@op/db/client';
import { profileInvites } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { CommonError, UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';

/**
 * Delete a pending profile invitation.
 * Only admins of the profile can delete invitations.
 */
export const deleteProfileInvitation = async ({
  inviteId,
  profileId,
  user,
}: {
  inviteId: string;
  profileId: string;
  user: User;
}) => {
  // Verify user has admin access to the profile
  const profileUser = await getProfileAccessUser({ user, profileId });

  if (!profileUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, profileUser.roles ?? []);

  // Get the invite and verify it belongs to this profile and is pending
  const invite = await db._query.profileInvites.findFirst({
    where: eq(profileInvites.id, inviteId),
  });

  if (!invite) {
    throw new CommonError('Invite not found');
  }

  if (invite.profileId !== profileId) {
    throw new CommonError('Invite does not belong to this profile');
  }

  // Invite is pending when acceptedOn is null
  if (invite.acceptedOn !== null) {
    throw new CommonError('Only pending invites can be revoked');
  }

  // Delete the invite
  await db.delete(profileInvites).where(eq(profileInvites.id, inviteId));

  return { success: true, email: invite.email };
};
