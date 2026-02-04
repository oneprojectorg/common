import { db, eq } from '@op/db/client';
import { profileInvites } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import {
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/error';
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
  // Fetch profile access and invite in parallel
  const [profileUser, invite] = await Promise.all([
    getProfileAccessUser({ user, profileId }),
    db.query.profileInvites.findFirst({
      where: { id: inviteId },
    }),
  ]);

  if (!profileUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, profileUser.roles ?? []);

  if (!invite || invite.profileId !== profileId) {
    throw new NotFoundError('Invite not found');
  }

  // Invite is pending when acceptedOn is null
  if (invite.acceptedOn !== null) {
    throw new ConflictError('Only pending invites can be revoked');
  }

  // Delete the invite
  await db.delete(profileInvites).where(eq(profileInvites.id, inviteId));

  return { success: true, email: invite.email };
};
