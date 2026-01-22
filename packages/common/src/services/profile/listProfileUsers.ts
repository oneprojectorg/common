import { and, db, eq, or, sql } from '@op/db/client';
import { profileUsers, profiles, users } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import {
  type SortDir,
  decodeCursor,
  encodeCursor,
  getCursorCondition,
} from '../../utils/db';
import { UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfile } from '../assert';
import type {
  ProfileUserQueryResult,
  ProfileUserWithRelations,
} from './getProfileUserWithRelations';

export type ProfileUserOrderBy = 'name' | 'email' | 'role';

type PaginatedProfileUsersResult = {
  items: ProfileUserWithRelations[];
  next: string | null;
  hasMore: boolean;
};

/**
 * List all members of a profile with cursor-based pagination
 */
export const listProfileUsers = async ({
  profileId,
  user,
  orderBy = 'name',
  dir = 'asc',
  query,
  cursor,
  limit = 25,
}: {
  profileId: string;
  user: User;
  orderBy?: ProfileUserOrderBy;
  dir?: SortDir;
  query?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<PaginatedProfileUsersResult> => {
  const [profileAccessUser] = await Promise.all([
    getProfileAccessUser({ user, profileId }),
    assertProfile(profileId),
  ]);

  if (!profileAccessUser) {
    throw new UnauthorizedError('You do not have access to this profile');
  }

  assertAccess({ profile: permission.ADMIN }, profileAccessUser.roles ?? []);

  // Build where clause with optional search filter (minimum 2 characters)
  // Uses ILIKE for substring matching and trigram word_similarity for fuzzy matching
  // The <% operator uses GIN trigram indexes for efficient fuzzy searching
  const searchFilter =
    query && query.length >= 2
      ? (() => {
          const ilikePattern = `%${query}%`;

          // Email: ILIKE for substring + trigram for typo tolerance
          const emailMatch = sql`(
            ${profileUsers.email} ILIKE ${ilikePattern}
            OR ${query} <% ${profileUsers.email}
          )`;

          // Name: single subquery combining ILIKE and trigram conditions
          const nameMatch = sql`${profileUsers.authUserId} IN (
            SELECT u.auth_user_id FROM ${users} u
            INNER JOIN ${profiles} p ON p.id = u.profile_id
            WHERE p.name ILIKE ${ilikePattern} OR ${query} <% p.name
          )`;

          return or(emailMatch, nameMatch);
        })()
      : undefined;

  // Determine the column to use for cursor-based pagination
  // For role sorting, we use email as the cursor column since role values can be duplicated
  const orderByColumn =
    orderBy === 'email' ? profileUsers.email : profileUsers.email;

  // Build cursor condition for pagination
  // Always use id as tiebreaker for stable pagination
  const cursorCondition = cursor
    ? getCursorCondition({
        column: orderByColumn,
        tieBreakerColumn: profileUsers.id,
        cursor: decodeCursor<{ value: string; id?: string }>(cursor),
        direction: dir,
      })
    : undefined;

  // Combine all conditions
  const baseCondition = eq(profileUsers.profileId, profileId);
  const conditions = [baseCondition, searchFilter, cursorCondition].filter(
    Boolean,
  );
  const whereClause =
    conditions.length > 1 ? and(...conditions) : baseCondition;

  // Fetch profile users with their roles and user profiles
  // Request one extra to check if there are more results
  const profileUserResults = await db._query.profileUsers.findMany({
    where: whereClause,
    with: {
      roles: {
        with: {
          accessRole: true,
        },
      },
      serviceUser: {
        with: {
          profile: {
            with: {
              avatarImage: true,
            },
          },
        },
      },
    },
    orderBy: (table, { asc, desc }) => {
      const orderFn = dir === 'desc' ? desc : asc;

      if (orderBy === 'role') {
        // Use a subquery to get the first role name for sorting
        // Note: Using raw SQL strings because Drizzle's sql template uses outer query aliases
        const roleNameSubquery = sql`(
          SELECT ar.name
          FROM "profileUser_to_access_roles" pur
          INNER JOIN "access_roles" ar ON ar.id = pur.access_role_id
          WHERE pur.profile_user_id = ${table.id}
          ORDER BY ar.name
          LIMIT 1
        )`;
        // Add email as secondary sort for consistent cursor pagination
        return [orderFn(roleNameSubquery), orderFn(table.email)];
      }

      if (orderBy === 'email') {
        return [orderFn(table.email)];
      }

      // Default to name, with email as secondary for consistent ordering
      return [orderFn(table.name), orderFn(table.email)];
    },
    limit: limit + 1,
  });

  // Check if there are more results
  const hasMore = profileUserResults.length > limit;
  const resultItems = hasMore
    ? profileUserResults.slice(0, limit)
    : profileUserResults;

  // Transform results
  const items = resultItems.map((result) => {
    const { serviceUser, roles, ...baseProfileUser } =
      result as ProfileUserQueryResult;
    const userProfile = serviceUser?.profile;

    return {
      ...baseProfileUser,
      name: userProfile?.name || baseProfileUser.name,
      about: userProfile?.bio || baseProfileUser.about,
      profile: userProfile ?? null,
      roles: roles.map((roleJunction) => roleJunction.accessRole),
    };
  });

  // Build next cursor from last item
  const lastItem = resultItems[resultItems.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? encodeCursor<{ value: string; id?: string }>({
          value: lastItem.email,
          id: lastItem.id,
        })
      : null;

  return {
    items,
    next: nextCursor,
    hasMore,
  };
};
