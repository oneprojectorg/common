import { db, eq } from '@op/db/client';
import {
  profileInvites,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import {
  CommonError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/error';

/**
 * Accept a profile invite, creating a profileUser with the specified role.
 */
export const acceptProfileInvite = async ({
  inviteId,
  user,
}: {
  inviteId: string;
  user: User;
}) => {
  // 1. Find the invite
  const invite = await db.query.profileInvites.findFirst({
    where: {
      id: inviteId,
    },
  });

  if (!invite) {
    throw new NotFoundError('Invite not found', inviteId);
  }

  if (invite.acceptedOn) {
    throw new ConflictError('This invite has already been accepted');
  }

  // TODO: We verify the user's email here. We should verify this only if an existing member doesn't exist. So we should store the profileId of the invitee. This comes in a separate PR updating the table with a migration
  if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
    throw new UnauthorizedError('This invite is for a different email address');
  }

  // 3. Check user isn't already a member
  const existingMembership = await db.query.profileUsers.findFirst({
    where: {
      profileId: invite.profileId,
      authUserId: user.id,
    },
  });

  if (existingMembership) {
    throw new CommonError('You are already a member of this profile');
  }

  // 4. Transaction: create profileUser, assign role, mark accepted
  const result = await db.transaction(async (tx) => {
    const [profileUser] = await tx
      .insert(profileUsers)
      .values({
        authUserId: user.id,
        profileId: invite.profileId,
        email: user.email!,
        name: user.user_metadata?.name || user.email?.split('@')[0],
      })
      .returning();

    if (!profileUser) {
      throw new CommonError('Failed to create profile user');
    }

    // Role assignment and invite update can run in parallel
    await Promise.all([
      tx.insert(profileUserToAccessRoles).values({
        profileUserId: profileUser.id,
        accessRoleId: invite.accessRoleId,
      }),
      tx
        .update(profileInvites)
        .set({ acceptedOn: new Date().toISOString() })
        .where(eq(profileInvites.id, inviteId)),
    ]);

    return profileUser;
  });

  return { profileUser: result };
};
