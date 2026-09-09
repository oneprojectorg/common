import { and, db, eq, isNull } from '@op/db/client';
import { profileInvites } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import { CommonError, NotFoundError } from '../../utils/error';
import { assignableRoleFilter } from '../access';
import { assertProfileAdmin } from '../assert';

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
    // Same filter the invite-creation path applies: without it an admin could
    // retarget a pending invite at a system global role, and acceptance trusts
    // the stored id.
    db.query.accessRoles.findFirst({
      where: {
        id: accessRoleId,
        RAW: (table) => assignableRoleFilter(table),
      },
    }),
  ]);

  if (!invite) {
    throw new NotFoundError('Profile invite', inviteId);
  }

  if (!role) {
    throw new CommonError('Invalid role specified');
  }

  // Check if user has ADMIN access on the profile
  await assertProfileAdmin({ user, profileId: invite.profileId });

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
