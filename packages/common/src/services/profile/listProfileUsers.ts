import { and, db, eq, gt, lt, or, sql } from '@op/db/client';
import { profileUsers, profiles, users } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import { assertAccess, permission } from 'access-zones';

import {
  type PaginatedResult,
  type SortDir,
  decodeCursor,
  encodeCursor,
} from '../../utils/db';
import { UnauthorizedError } from '../../utils/error';
import { getProfileAccessUser } from '../access';
import { assertProfile } from '../assert';
import type {
  ProfileUserQueryResult,
  ProfileUserWithRelations,
} from './getProfileUserWithRelations';

export type ProfileUserOrderBy = 'name' | 'email' | 'role';

/**
 * Builds a subquery to get the first role name (alphabetically) for a profile user.
 * Used for both ORDER BY and cursor conditions to ensure consistency.
 * Returns empty string if user has no roles (via COALESCE) to match JS cursor encoding.
 */
const buildRoleNameSubquery = (profileUserIdColumn: unknown) => sql`COALESCE((
  SELECT ar.name
  FROM "profileUser_to_access_roles" pur
  INNER JOIN "access_roles" ar ON ar.id = pur.access_role_id
  WHERE pur.profile_user_id = ${profileUserIdColumn}
  ORDER BY ar.name
  LIMIT 1
), '')`;

/**
 * List all members of a profile with cursor-based pagination.
 * Includes both active members and pending invites.
 * Pending invites are appended after active members on the last page.
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
}): Promise<PaginatedResult<ProfileUserWithRelations>> => {
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

  // Build cursor condition for pagination
  // The cursor must match the ORDER BY columns for correct pagination
  type ProfileUserCursor = { value: string; tiebreaker?: string };
  const decodedCursor = cursor
    ? decodeCursor<ProfileUserCursor>(cursor)
    : undefined;

  const compareFn = dir === 'asc' ? gt : lt;

  const buildCursorCondition = () => {
    if (!decodedCursor) {
      return undefined;
    }

    if (orderBy === 'email') {
      // Email is unique, no tiebreaker needed
      return compareFn(profileUsers.email, decodedCursor.value);
    }

    if (orderBy === 'name') {
      // ORDER BY name, email - compound condition
      return or(
        compareFn(profileUsers.name, decodedCursor.value),
        and(
          eq(profileUsers.name, decodedCursor.value),
          compareFn(profileUsers.email, decodedCursor.tiebreaker ?? ''),
        ),
      );
    }

    // orderBy === 'role' - uses shared subquery helper
    const roleSubquery = buildRoleNameSubquery(profileUsers.id);
    const compareOp = dir === 'asc' ? sql`>` : sql`<`;
    return sql`(
      ${roleSubquery} ${compareOp} ${decodedCursor.value}
      OR (${roleSubquery} = ${decodedCursor.value} AND ${profileUsers.email} ${compareOp} ${decodedCursor.tiebreaker ?? ''})
    )`;
  };

  const cursorCondition = buildCursorCondition();

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
        // Use shared subquery helper for consistency with cursor condition
        const roleNameSubquery = buildRoleNameSubquery(table.id);
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
  const resultItems = profileUserResults.slice(0, limit);

  // Transform to ProfileUserWithRelations shape
  const items: ProfileUserWithRelations[] = resultItems.map((result) => {
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
  // Cursor value must match the primary ORDER BY column
  const lastResult = resultItems[resultItems.length - 1];
  const buildNextCursor = (): string | null => {
    if (!hasMore || !lastResult) {
      return null;
    }

    if (orderBy === 'email') {
      return encodeCursor<ProfileUserCursor>({ value: lastResult.email });
    }

    if (orderBy === 'name') {
      return encodeCursor<ProfileUserCursor>({
        value: lastResult.name ?? '',
        tiebreaker: lastResult.email,
      });
    }

    // orderBy === 'role' - get first role name alphabetically (matching the ORDER BY subquery)
    // Use simple string comparison to match PostgreSQL's default collation
    const sortedRoles = [...lastResult.roles].sort((a, b) => {
      const nameA = a.accessRole?.name ?? '';
      const nameB = b.accessRole?.name ?? '';
      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }
      return 0;
    });
    const firstRoleName = sortedRoles[0]?.accessRole?.name ?? '';
    return encodeCursor<ProfileUserCursor>({
      value: firstRoleName,
      tiebreaker: lastResult.email,
    });
  };

  const nextCursor = buildNextCursor();

  return {
    items,
    next: nextCursor,
  };
};
