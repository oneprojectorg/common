import { db, sql } from '@op/db/client';
import { profiles } from '@op/db/schema';
import type { ClaimsUser } from '@op/supabase/lib';

import { assertProfile, assertProfileAdmin } from '../assert';

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
  user: ClaimsUser;
  query?: string;
}) => {
  // Check existence before access so a nonexistent profile is a 404
  // regardless of the caller's permissions.
  await assertProfile(profileId);
  await assertProfileAdmin({ user, profileId });

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
