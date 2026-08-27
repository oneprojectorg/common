import { and, db, eq, gt, lt, or, type SQL, sql } from '@op/db/client';
import { profileUsers, profiles, users } from '@op/db/schema';
import type { User } from '@op/supabase/lib';

import {
  type PaginatedResult,
  type SortDir,
  decodeCursor,
  encodeCursor,
  excludeGlobalUsers,
} from '../../utils/db';
import { assertProfile, assertProfileAdmin } from '../assert';
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
}): Promise<PaginatedResult<ProfileUserWithRelations>> => {
  // Check existence before access so a nonexistent profile is a 404
  // regardless of the caller's permissions.
  await assertProfile(profileId);
  await assertProfileAdmin({ user, profileId });

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

          return or(
            emailMatch,
            // Check profileUsers.name directly (for users without a linked profile)
            sql`${profileUsers.name} ILIKE ${ilikePattern}`,
            // Check via users → profiles join for users with a full profile
            sql`${profileUsers.authUserId} IN (
              SELECT u.auth_user_id FROM ${users} u
              INNER JOIN ${profiles} p ON p.id = u.profile_id
              WHERE p.name ILIKE ${ilikePattern} OR ${query} <% p.name
            )`,
          );
        })()
      : undefined;

  // Build cursor condition for pagination
  // The cursor must match the ORDER BY columns for correct pagination.
  // `id` is optional only so a cursor issued before this tiebreaker existed
  // (e.g. handed to a client mid-pagination across a deploy) doesn't decode
  // into a broken comparison.
  type ProfileUserCursor = { value: string; tiebreaker?: string; id?: string };
  const decodedCursor = cursor
    ? decodeCursor<ProfileUserCursor>(cursor)
    : undefined;

  const compareFn = dir === 'asc' ? gt : lt;
  const emailExpr = sql`coalesce(${profileUsers.email}, '')`;
  const nameExpr = sql`coalesce(${profileUsers.name}, '')`;

  /**
   * Builds a strictly-monotonic keyset condition from an ordered list of sort
   * keys, each paired with its cursor value: key1 > v1 OR (key1 = v1 AND key2
   * > v2) OR ... . `email` and `name` are both nullable and non-unique, so a
   * cursor built from only those columns can tie: two rows with the same
   * (name, email) — both NULL, or a duplicated real email — would otherwise
   * either repeat across pages or never satisfy the comparison at all. `id`
   * is always the last key so the order is total.
   */
  const buildKeysetCondition = (
    keys: Array<{ expr: SQL; value: string }>,
  ): SQL =>
    or(
      ...keys.map((key, i) => {
        const comparison = compareFn(key.expr, key.value);
        const precedingEqualities = keys
          .slice(0, i)
          .map((k) => eq(k.expr, k.value));
        return precedingEqualities.length > 0
          ? and(...precedingEqualities, comparison)
          : comparison;
      }),
    )!;

  const buildCursorCondition = () => {
    if (!decodedCursor) {
      return undefined;
    }

    const idKey = decodedCursor.id
      ? [{ expr: sql`${profileUsers.id}`, value: decodedCursor.id }]
      : [];

    if (orderBy === 'email') {
      return buildKeysetCondition([
        { expr: emailExpr, value: decodedCursor.value },
        ...idKey,
      ]);
    }

    if (orderBy === 'name') {
      return buildKeysetCondition([
        { expr: nameExpr, value: decodedCursor.value },
        { expr: emailExpr, value: decodedCursor.tiebreaker ?? '' },
        ...idKey,
      ]);
    }

    // orderBy === 'role' - uses shared subquery helper
    const roleSubquery = buildRoleNameSubquery(profileUsers.id);
    return buildKeysetCondition([
      { expr: roleSubquery, value: decodedCursor.value },
      { expr: emailExpr, value: decodedCursor.tiebreaker ?? '' },
      ...idKey,
    ]);
  };

  const cursorCondition = buildCursorCondition();

  // Combine all conditions
  const baseCondition = and(
    eq(profileUsers.profileId, profileId),
    excludeGlobalUsers(profileUsers.authUserId),
  );
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
      // Coalesced to match the cursor condition, with id as the final
      // tiebreaker so the sort is total even when every other key ties.
      const tableEmailExpr = sql`coalesce(${table.email}, '')`;

      if (orderBy === 'role') {
        // Use shared subquery helper for consistency with cursor condition
        const roleNameSubquery = buildRoleNameSubquery(table.id);
        return [
          orderFn(roleNameSubquery),
          orderFn(tableEmailExpr),
          orderFn(table.id),
        ];
      }

      if (orderBy === 'email') {
        return [orderFn(tableEmailExpr), orderFn(table.id)];
      }

      // Default to name, with email + id as secondary tiebreakers
      return [
        orderFn(sql`coalesce(${table.name}, '')`),
        orderFn(tableEmailExpr),
        orderFn(table.id),
      ];
    },
    limit: limit + 1,
  });

  // Check if there are more results
  const hasMore = profileUserResults.length > limit;
  const resultItems = profileUserResults.slice(0, limit);

  // Transform results
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

  const lastResult = resultItems[resultItems.length - 1];
  const buildNextCursor = (): string | null => {
    if (!hasMore || !lastResult) {
      return null;
    }

    if (orderBy === 'email') {
      return encodeCursor<ProfileUserCursor>({
        value: lastResult.email ?? '',
        id: lastResult.id,
      });
    }

    if (orderBy === 'name') {
      return encodeCursor<ProfileUserCursor>({
        value: lastResult.name ?? '',
        tiebreaker: lastResult.email ?? '',
        id: lastResult.id,
      });
    }

    // orderBy === 'role' - get first role name alphabetically (matching the ORDER BY subquery)
    // Use simple string comparison to match PostgreSQL's default collation
    const sortedRoles = [...lastResult.roles].sort((a, b) => {
      const nameA = a.accessRole.name;
      const nameB = b.accessRole.name;
      if (nameA < nameB) {
        return -1;
      }
      if (nameA > nameB) {
        return 1;
      }
      return 0;
    });
    const firstRoleName = sortedRoles[0]?.accessRole.name ?? '';
    return encodeCursor<ProfileUserCursor>({
      value: firstRoleName,
      tiebreaker: lastResult.email ?? '',
      id: lastResult.id,
    });
  };

  const nextCursor = buildNextCursor();

  return {
    items,
    next: nextCursor,
  };
};
