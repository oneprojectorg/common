import { and, db, eq, isNull, sql } from '@op/db/client';
import { type AccessRole, profileInvites } from '@op/db/schema';
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

  // Build search filter with ILIKE for substring + trigram for typo tolerance
  // Matches the approach used in listProfileUsers
  const searchFilter =
    query && query.length >= 2
      ? (() => {
          const ilikePattern = `%${query}%`;
          return sql`(
            ${profileInvites.email} ILIKE ${ilikePattern}
            OR ${query} <% ${profileInvites.email}
          )`;
        })()
      : undefined;

  // Combine conditions
  const baseCondition = and(
    eq(profileInvites.profileId, profileId),
    isNull(profileInvites.acceptedOn),
  );
  const whereClause = searchFilter
    ? and(baseCondition, searchFilter)
    : baseCondition;

  const inviteResults = await db._query.profileInvites.findMany({
    where: whereClause,
    with: {
      accessRole: true,
    },
    orderBy: (table, { asc }) => [asc(table.email)],
  });

  return inviteResults.map((invite) => ({
    id: invite.id,
    email: invite.email,
    profileId: invite.profileId,
    role: invite.accessRole as unknown as AccessRole | null,
    createdAt: invite.createdAt,
  }));
};
