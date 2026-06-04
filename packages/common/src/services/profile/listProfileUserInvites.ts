import { db, sql } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { permission } from 'access-zones';

import { assertProfile, assertProfileAccess } from '../assert';

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
  await Promise.all([
    assertProfileAccess({
      user,
      profileId,
      permissions: { profile: permission.ADMIN },
    }),
    assertProfile(profileId),
  ]);

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
