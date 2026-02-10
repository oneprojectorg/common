import { db, sql } from '@op/db/client';
import { profileInvites } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfile } from '../assert';

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
}) => {
  const [profileAccessUser] = await Promise.all([
    getProfileAccessUser({ user, profileId }),
    assertProfile(profileId),
  ]);

  if (!profileAccessUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, profileAccessUser.roles ?? []);

  const trimmedQuery = query?.trim();
  const searchFilter =
    trimmedQuery && trimmedQuery.length >= 2
      ? sql`(
          ${profileInvites.email} ILIKE ${`%${trimmedQuery}%`}
          OR ${trimmedQuery} <% ${profileInvites.email}
        )`
      : undefined;

  return db.query.profileInvites.findMany({
    where: {
      profileId,
      acceptedOn: { isNull: true },
      ...(searchFilter && { RAW: () => searchFilter }),
    },
    with: {
      accessRole: true,
      inviteeProfile: {
        with: {
          avatarImage: true,
        },
      },
    },
    orderBy: { email: 'asc' },
  });
};
