import { db, sql } from '@op/db/client';
import { profiles } from '@op/db/schema';
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

  return db.query.profileInvites.findMany({
    where: {
      profileId,
      acceptedOn: { isNull: true },
      ...(trimmedQuery &&
        trimmedQuery.length >= 2 && {
          RAW: (table) => {
            const ilikePattern = `%${trimmedQuery}%`;
            return sql`(
              ${table.email} ILIKE ${ilikePattern}
              OR ${trimmedQuery} <% ${table.email}
              OR ${table.inviteeProfileId} IN (
                SELECT id FROM ${profiles}
                WHERE name ILIKE ${ilikePattern} OR ${trimmedQuery} <% name
              )
            )`;
          },
        }),
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
