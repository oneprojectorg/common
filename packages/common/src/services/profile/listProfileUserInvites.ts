import { db } from '@op/db/client';
import type { AccessRole } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfile } from '../assert';

export type ProfileInviteMember = {
  id: string;
  email: string;
  profileId: string;
  role: AccessRole | null;
  createdAt: string | null;
};

/**
 * List pending invites for a profile.
 * Only admins can view pending invites.
 */
export const listProfileUserInvites = async ({
  profileId,
  user,
  query,
}: {
  profileId: string;
  user: User;
  query?: string;
}): Promise<ProfileInviteMember[]> => {
  const [profileAccessUser] = await Promise.all([
    getProfileAccessUser({ user, profileId }),
    assertProfile(profileId),
  ]);

  if (!profileAccessUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, profileAccessUser.roles ?? []);

  const inviteResults = await db.query.profileInvites.findMany({
    where: {
      profileId,
      acceptedOn: { isNull: true },
    },
    with: {
      accessRole: true,
    },
    orderBy: {
      email: 'asc',
    },
  });

  // Filter by search query if provided (minimum 2 characters)
  const filteredInvites =
    query && query.length >= 2
      ? inviteResults.filter((invite) =>
          invite.email.toLowerCase().includes(query.toLowerCase()),
        )
      : inviteResults;

  return filteredInvites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    profileId: invite.profileId,
    role: invite.accessRole,
    createdAt: invite.createdAt,
  }));
};
