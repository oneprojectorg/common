import { and, db, eq, or, sql } from '@op/db/client';
import { profileUsers, profiles, users } from '@op/db/schema';
import type { User } from '@op/supabase/lib';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

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
const buildRoleNameSubquery = (
  profileUserIdColumn: AnyPgColumn,
) => sql`COALESCE((
  SELECT ar.name
  FROM "profileUser_to_access_roles" pur
  INNER JOIN "access_roles" ar ON ar.id = pur.access_role_id
  WHERE pur.profile_user_id = ${profileUserIdColumn}
  ORDER BY ar.name
  LIMIT 1
), '')`;

/**
 * The name the API returns for a profile user: the linked profile's name when
 * the user has a profile, otherwise the denormalized `profileUsers.name`.
 * Mirrors `buildDisplayNameSubquery` below, which sorts and paginates on the
 * SQL equivalent — the two have to stay in sync.
 */
const resolveDisplayName = (result: ProfileUserQueryResult): string | null =>
  result.serviceUser?.profile?.name || result.name;

/**
 * Builds the sort key for the name column: the linked profile's name when the
 * user has a profile, otherwise the denormalized `profileUsers.name`. This has
 * to mirror `resolveDisplayName` — `profileUsers.name` is null or stale for
 * profile-linked users, so ordering on that column alone leaves the displayed
 * names looking unsorted. Coalesces to empty string (never null) so ORDER BY
 * and the cursor condition agree on where nameless rows sit, and orders the
 * inner select so the sort key can't shift between the two if an auth user
 * somehow has more than one `users` row.
 *
 * The `u` / `p` aliases and the raw column names are load-bearing: interpolating
 * `users.authUserId` / `profiles.name` instead makes drizzle rewrite them to the
 * aliases it gave the `serviceUser` / `profile` lateral joins in the enclosing
 * query, which silently turns the correlated subquery into a reference to those
 * outer laterals and mis-sorts the page.
 */
const buildDisplayNameSubquery = ({
  authUserIdColumn,
  nameColumn,
}: {
  authUserIdColumn: AnyPgColumn;
  nameColumn: AnyPgColumn;
}) => sql`COALESCE(NULLIF((
  SELECT p.name
  FROM ${users} u
  INNER JOIN ${profiles} p ON p.id = u.profile_id
  WHERE u.auth_user_id = ${authUserIdColumn}
  ORDER BY p.name
  LIMIT 1
), ''), NULLIF(${nameColumn}, ''), '')`;

/**
 * Sort key for the email column. `profileUsers.email` is nullable, and a null
 * sort key can never satisfy the cursor comparison, so a participant without an
 * email would drop off after the first page. Coalescing keeps them reachable —
 * they sort with the empty names rather than at the far end.
 */
const buildEmailSortKey = (emailColumn: AnyPgColumn) =>
  sql`COALESCE(${emailColumn}, '')`;

/**
 * The sort key each `orderBy` paginates on, alongside the row's id. `id` is the
 * primary key, so `(sortKey, id)` is a total order — `profileUsers.email` is
 * nullable and carries no unique constraint, so it can't tiebreak reliably.
 */
const buildSortKey = ({
  orderBy,
  idColumn,
  authUserIdColumn,
  nameColumn,
  emailColumn,
}: {
  orderBy: ProfileUserOrderBy;
  idColumn: AnyPgColumn;
  authUserIdColumn: AnyPgColumn;
  nameColumn: AnyPgColumn;
  emailColumn: AnyPgColumn;
}) => {
  if (orderBy === 'email') {
    return buildEmailSortKey(emailColumn);
  }

  if (orderBy === 'role') {
    return buildRoleNameSubquery(idColumn);
  }

  return buildDisplayNameSubquery({ authUserIdColumn, nameColumn });
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
  // The cursor must match the ORDER BY columns for correct pagination
  type ProfileUserCursor = { value: string; tiebreaker?: string };
  const decodedCursor = cursor
    ? decodeCursor<ProfileUserCursor>(cursor)
    : undefined;

  const buildCursorCondition = () => {
    if (!decodedCursor?.tiebreaker) {
      return undefined;
    }

    // Row-wise comparison against the same `(sortKey, id)` pair the rows are
    // ordered by. Spelled as a row constructor rather than the equivalent
    // `a > x OR (a = x AND b > y)` so the sort key — a correlated subquery for
    // name and role — is inlined once instead of twice; Postgres does no
    // common-subexpression elimination across separate subplans.
    const sortKey = buildSortKey({
      orderBy,
      idColumn: profileUsers.id,
      authUserIdColumn: profileUsers.authUserId,
      nameColumn: profileUsers.name,
      emailColumn: profileUsers.email,
    });
    const compareOp = dir === 'asc' ? sql`>` : sql`<`;

    return sql`(${sortKey}, ${profileUsers.id}) ${compareOp} (${decodedCursor.value}, ${decodedCursor.tiebreaker}::uuid)`;
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
  // `db._query` is the legacy v1 relational API: it types nested relations as
  // `{ [x: string]: any }` and doesn't narrow one-to-one relations, so the
  // relation shape is asserted once here, at the boundary.
  const profileUserResults = (await db._query.profileUsers.findMany({
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

      // Same `(sortKey, id)` pair the cursor condition compares against.
      const sortKey = buildSortKey({
        orderBy,
        idColumn: table.id,
        authUserIdColumn: table.authUserId,
        nameColumn: table.name,
        emailColumn: table.email,
      });

      return [orderFn(sortKey), orderFn(table.id)];
    },
    limit: limit + 1,
  })) as ProfileUserQueryResult[];

  // Check if there are more results
  const hasMore = profileUserResults.length > limit;
  const resultItems = profileUserResults.slice(0, limit);

  // Transform results
  const items: ProfileUserWithRelations[] = resultItems.map((result) => {
    const { serviceUser, roles, ...baseProfileUser } = result;
    const userProfile = serviceUser?.profile;

    return {
      ...baseProfileUser,
      name: resolveDisplayName(result),
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

    // `id` is the tiebreaker for every sort, matching the ORDER BY above.
    const tiebreaker = lastResult.id;

    if (orderBy === 'email') {
      return encodeCursor<ProfileUserCursor>({
        value: lastResult.email ?? '',
        tiebreaker,
      });
    }

    if (orderBy === 'name') {
      return encodeCursor<ProfileUserCursor>({
        value: resolveDisplayName(lastResult) ?? '',
        tiebreaker,
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
      tiebreaker,
    });
  };

  const nextCursor = buildNextCursor();

  return {
    items,
    next: nextCursor,
  };
};
