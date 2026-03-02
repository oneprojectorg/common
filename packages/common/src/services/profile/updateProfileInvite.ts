import { and, db, eq, isNull } from '@op/db/client';
import { type ProfileInvite, profileInvites } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import {
  CommonError,
  NotFoundError,
  UnauthorizedError,
} from '../../utils/error';
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
  // Fetch invite and validate role in parallel (independent queries)
  const [invite, role] = await Promise.all([
    db.query.profileInvites.findFirst({
      where: {
        id: inviteId,
        acceptedOn: { isNull: true },
      },
      with: {
        profile: true,
      },
    }),
    db.query.accessRoles.findFirst({
      where: { id: accessRoleId },
    }),
  ]);

  if (!invite) {
    throw new NotFoundError('Invite not found');
  }

  if (!role) {
    throw new CommonError('Invalid role specified');
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

  return updated;
};
