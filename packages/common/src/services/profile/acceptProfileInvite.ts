import { db, eq } from '@op/db/client';
import {
  profileInvites,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, UnauthorizedError } from '../../utils/error';

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
  // 1. Find the pending invite (acceptedOn is null means pending)
  const invite = await db._query.profileInvites.findFirst({
    where: (table, { eq, and, isNull }) =>
      and(eq(table.id, inviteId), isNull(table.acceptedOn)),
  });

  if (!invite) {
    throw new CommonError('Invite not found or already accepted');
  }

  // 2. Verify user's email matches (case-insensitive)
  if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
    throw new UnauthorizedError('This invite is for a different email address');
  }

  // 3. Check user isn't already a member
  const existingMembership = await db._query.profileUsers.findFirst({
    where: (table, { eq, and }) =>
      and(eq(table.profileId, invite.profileId), eq(table.authUserId, user.id)),
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
