import { and, db, eq, isNull } from '@op/db/client';
import { profileInvites } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { CommonError, NotFoundError } from '../../utils/error';
import { assertProfileAccess } from '../assert';

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
}) => {
  // Fetch invite and validate role in parallel (independent queries)
  const [invite, role] = await Promise.all([
    db.query.profileInvites.findFirst({
      where: {
        id: inviteId,
        acceptedOn: { isNull: true },
      },
      with: {
        profile: true,
        inviteeProfile: {
          with: {
            avatarImage: true,
          },
        },
      },
    }),
    db.query.accessRoles.findFirst({
      where: { id: accessRoleId },
    }),
  ]);

  if (!invite) {
    throw new NotFoundError('Profile invite', inviteId);
  }

  if (!role) {
    throw new CommonError('Invalid role specified');
  }

  // Check if user has ADMIN access on the profile
  await assertProfileAccess(
    { user, profileId: invite.profileId },
    { profile: permission.ADMIN },
  );

  // Update the invite
  const [updated] = await db
    .update(profileInvites)
    .set({ accessRoleId })
    .where(
      and(eq(profileInvites.id, inviteId), isNull(profileInvites.acceptedOn)),
    )
    .returning();

  if (!updated) {
    throw new CommonError('Failed to update invite');
  }

  return {
    ...updated,
    inviteeProfile: invite.inviteeProfile ?? null,
  };
};
