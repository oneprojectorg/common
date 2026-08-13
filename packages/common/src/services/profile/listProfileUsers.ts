import { and, db, eq, or, sql } from '@op/db/client';
import { profileUsers, profiles, users } from '@op/db/schema';
import { logger } from '@op/logging';
import type { User } from '@op/supabase/lib';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import {
  type PaginatedResult,
  type SortDir,
  decodeCursorIfValid,
  encodeCursor,
  excludeGlobalUsers,
} from '../../utils/db';
import { assertProfile, assertProfileAdmin } from '../assert';
import type {
  ProfileUserQueryResult,
  ProfileUserWithRelations,
} from './getProfileUserWithRelations';

export type ProfileUserOrderBy = 'name' | 'email' | 'role';

/** The tiebreaker is a `profileUsers.id`, cast to uuid in the comparison. */
const cursorSchema = z.object({
  value: z.string(),
  tiebreaker: z.string().uuid(),
});

type ProfileUserCursor = z.infer<typeof cursorSchema>;

/** First role name alphabetically, or '' — matching what the cursor encodes. */
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

/** Must stay in sync with `buildDisplayNameSubquery`, the SQL equivalent. */
const resolveDisplayName = (result: ProfileUserQueryResult): string | null =>
  result.serviceUser?.profile?.name || result.name;

/**
 * Mirrors `resolveDisplayName`. Never null, so the ORDER BY and the cursor
 * agree on where nameless rows sit — a null sort key can't satisfy the cursor
 * comparison, and the row would vanish after the first page.
 *
 * The `u` / `p` aliases and raw column names are load-bearing: interpolating
 * `profiles.name` instead makes drizzle rewrite it to the alias it gave the
 * `profile` lateral join in the enclosing query, silently turning this into a
 * reference to that outer join. Renders fine in isolation; mis-sorts for real.
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

/** Coalesced for the same reason: `email` is nullable. */
const buildEmailSortKey = (emailColumn: AnyPgColumn) =>
  sql`COALESCE(${emailColumn}, '')`;

/**
 * Paired with `id` for a total order — `email` is nullable and non-unique, so
 * it can't tiebreak reliably.
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

  // Cursors issued before the tiebreaker moved off `email` carry an address,
  // and Postgres rejects a non-uuid on the cast — so a client mid-scroll across
  // the deploy repeats a page instead of seeing a 500.
  const decodedCursor = cursor
    ? decodeCursorIfValid(cursor, cursorSchema)
    : undefined;

  if (cursor && !decodedCursor) {
    // Otherwise invisible: re-walking from page 1 looks identical to never
    // having paginated.
    logger.warn('Discarded an unusable participants cursor', { orderBy });
  }

  const buildCursorCondition = () => {
    if (!decodedCursor) {
      return undefined;
    }

    // A row constructor rather than the equivalent `a > x OR (a = x AND b > y)`
    // so the sort key — a correlated subquery — is inlined once, not twice.
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
  // `db._query` is the legacy v1 API and types relations loosely, so the shape
  // is asserted once here, at the boundary.
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

    // Matches the ORDER BY tiebreaker for every sort.
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
