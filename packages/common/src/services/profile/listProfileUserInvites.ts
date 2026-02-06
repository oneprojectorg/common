import { and, db, eq, isNull, sql } from '@op/db/client';
import {
  type AccessRole,
  type ProfileInvite,
  profileInvites,
} from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfile } from '../assert';

/**
 * Query result type for profile invite with its access role relation.
 * accessRole is NOT NULL in the schema, so it's always present.
 */
type ProfileInviteQueryResult = ProfileInvite & {
  accessRole: AccessRole;
};

export type ProfileInviteMember = {
  id: string;
  email: string;
  profileId: string;
  role: {
    id: string;
    name: string;
    description: string | null;
  };
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
  const trimmedQuery = query?.trim();
  const searchFilter =
    trimmedQuery && trimmedQuery.length >= 2
      ? (() => {
          const ilikePattern = `%${trimmedQuery}%`;
          return sql`(
            ${profileInvites.email} ILIKE ${ilikePattern}
            OR ${trimmedQuery} <% ${profileInvites.email}
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

  const inviteResults = (await db.query.profileInvites.findMany({
    where: {
      RAW: whereClause,
    },
    with: {
      accessRole: true,
    },
    orderBy: {
      email: 'asc',
    },
  })) as ProfileInviteQueryResult[];

  return inviteResults.map((invite) => ({
    id: invite.id,
    email: invite.email,
    profileId: invite.profileId,
    role: invite.accessRole,
    createdAt: invite.createdAt,
  }));
};
