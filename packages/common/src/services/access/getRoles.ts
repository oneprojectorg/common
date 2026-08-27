import {
  type SQL,
  and,
  asc,
  count,
  db,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  or,
  sql,
} from '@op/db/client';
import {
  accessRolePermissionsOnAccessZones,
  accessRoles,
  accessZones,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import { type Permission, fromBitField } from 'access-zones';

import {
  type PaginatedResult,
  type SortDir,
  decodeCursor,
  encodeCursor,
  excludeGlobalUsers,
} from '../../utils/db';

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions?: Permission;
  memberCount?: number;
}

/**
 * The global roles exposed through role listings (invite modals, member role
 * dropdowns). Global roles outside this list are system roles that are never
 * granted by hand — e.g. the global Public role, whose permissions everyone
 * holds by default — so offering them as an invite/assignment option is
 * meaningless. Names are the runtime identifier for global roles (see
 * assertGlobalRole); they are seeded and cannot be renamed via the API.
 */
export const EXPOSABLE_GLOBAL_ROLE_NAMES = ['Admin', 'Member'];

/**
 * Filter matching only roles an admin may hand out: profile-scoped roles and
 * exposable global roles. Apply via `RAW` in the role lookup of assignment
 * paths (invites, member role updates) so that system global roles resolve as
 * nonexistent and hit the caller's existing invalid-role handling. System
 * roles are granted only by their dedicated services (e.g. the
 * public-participation flow), never by hand. Accepts the callback's table arg
 * since db.query aliases tables.
 */
export const assignableRoleFilter = (accessRoleCols: typeof accessRoles): SQL =>
  or(
    isNotNull(accessRoleCols.profileId),
    inArray(accessRoleCols.name, EXPOSABLE_GLOBAL_ROLE_NAMES),
  )!;

type RoleCursor = { value: string; id: string };

/**
 * Get roles for a profile or global roles with cursor-based pagination.
 * - If profileId is provided: returns only roles specific to that profile
 * - If no profileId: returns only exposable global roles (profileId IS NULL
 *   and named in EXPOSABLE_GLOBAL_ROLE_NAMES)
 * - If zoneName is provided: includes permission for that zone
 * - If includeMemberCounts is set (and profileId is present): each role gains
 *   a memberCount — the number of profile members holding that role
 */
export const getRoles = async (params?: {
  profileId?: string;
  zoneName?: string;
  includeMemberCounts?: boolean;
  cursor?: string | null;
  limit?: number;
  dir?: SortDir;
}): Promise<PaginatedResult<Role>> => {
  const {
    profileId = null,
    zoneName,
    includeMemberCounts,
    cursor,
    limit = 25,
    dir = 'asc',
  } = params ?? {};

  // Build cursor condition for pagination
  const decodedCursor = cursor ? decodeCursor<RoleCursor>(cursor) : undefined;
  const compareFn = dir === 'asc' ? gt : lt;

  /**
   * Builds a where condition using the provided table columns.
   * Accepts either the raw schema columns (for select-based queries)
   * or aliased table columns (for db.query which aliases tables).
   */
  const buildWhereCondition = (accessRoleCols: typeof accessRoles): SQL => {
    const cursorCondition = decodedCursor
      ? or(
          compareFn(accessRoleCols.name, decodedCursor.value),
          and(
            eq(accessRoleCols.name, decodedCursor.value),
            compareFn(accessRoleCols.id, decodedCursor.id),
          ),
        )
      : undefined;

    const profileCondition = profileId
      ? eq(accessRoleCols.profileId, profileId)
      : and(
          isNull(accessRoleCols.profileId),
          inArray(accessRoleCols.name, EXPOSABLE_GLOBAL_ROLE_NAMES),
        )!;

    return cursorCondition
      ? and(profileCondition, cursorCondition)!
      : profileCondition;
  };

  const shouldIncludeMemberCounts = includeMemberCounts && !!profileId;

  // The role junction's accessRoleId index bounds the correlated lookup.
  const memberCountSubquery = (accessRoleCols: typeof accessRoles) =>
    db
      .select({ count: count() })
      .from(profileUserToAccessRoles)
      .innerJoin(
        profileUsers,
        eq(profileUsers.id, profileUserToAccessRoles.profileUserId),
      )
      .where(
        and(
          eq(profileUserToAccessRoles.accessRoleId, accessRoleCols.id),
          eq(profileUsers.profileId, profileId!),
          excludeGlobalUsers(profileUsers.authUserId),
        ),
      );

  // Use join-based query when zoneName is provided for DB-level filtering
  if (zoneName) {
    const rows = await db
      .select({
        id: accessRoles.id,
        name: accessRoles.name,
        description: accessRoles.description,
        permission: accessRolePermissionsOnAccessZones.permission,
        ...(shouldIncludeMemberCounts && {
          memberCount: sql<number>`(${memberCountSubquery(accessRoles)})`,
        }),
      })
      .from(accessRoles)
      .leftJoin(
        accessRolePermissionsOnAccessZones,
        and(
          eq(accessRolePermissionsOnAccessZones.accessRoleId, accessRoles.id),
          eq(
            accessRolePermissionsOnAccessZones.accessZoneId,
            db
              .select({ id: accessZones.id })
              .from(accessZones)
              .where(eq(accessZones.name, zoneName)),
          ),
          // Only the role's global permission row: per-profile override rows
          // would multiply join rows (breaking limit-based pagination) and are
          // read via the effective resolvers (e.g. getDecisionRole) instead.
          isNull(accessRolePermissionsOnAccessZones.profileId),
        ),
      )
      .where(buildWhereCondition(accessRoles))
      .orderBy(
        dir === 'desc' ? desc(accessRoles.name) : asc(accessRoles.name),
        dir === 'desc' ? desc(accessRoles.id) : asc(accessRoles.id),
      )
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const resultItems = rows.slice(0, limit);

    const items: Role[] = resultItems.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      permissions: fromBitField(row.permission ?? 0),
      ...(shouldIncludeMemberCounts && { memberCount: row.memberCount ?? 0 }),
    }));

    const lastItem = resultItems[resultItems.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? encodeCursor<RoleCursor>({ value: lastItem.name, id: lastItem.id })
        : null;

    return { items, next: nextCursor };
  }

  // Simple query without permissions when no zoneName
  const roles = await db.query.accessRoles.findMany({
    where: {
      RAW: (table) => buildWhereCondition(table),
    },
    orderBy:
      dir === 'desc'
        ? { name: 'desc', id: 'desc' }
        : { name: 'asc', id: 'asc' },
    // extras always runs, but the expression is a cheap constant unless the
    // caller opted in — this keeps `role.memberCount` reliably typed while
    // still avoiding the correlated subquery for callers that don't need it.
    extras: {
      memberCount: (table, { sql: sqlOp }) =>
        shouldIncludeMemberCounts
          ? sqlOp<number>`(${memberCountSubquery(table)})`.as('member_count')
          : sqlOp<number>`0`.as('member_count'),
    },
    limit: limit + 1,
  });

  // Check if there are more results
  const hasMore = roles.length > limit;
  const resultItems = roles.slice(0, limit);

  // Transform results
  const items: Role[] = resultItems.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    ...(shouldIncludeMemberCounts && { memberCount: role.memberCount ?? 0 }),
  }));

  // Build next cursor from last item
  const lastItem = resultItems[resultItems.length - 1];
  const nextCursor =
    hasMore && lastItem
      ? encodeCursor<RoleCursor>({ value: lastItem.name, id: lastItem.id })
      : null;

  return {
    items,
    next: nextCursor,
  };
};
