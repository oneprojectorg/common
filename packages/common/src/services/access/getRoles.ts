import {
  type SQL,
  and,
  asc,
  db,
  desc,
  eq,
  gt,
  isNull,
  lt,
  or,
} from '@op/db/client';
import {
  accessRolePermissionsOnAccessZones,
  accessRoles,
  accessZones,
} from '@op/db/schema';
import { type Permission, fromBitField } from 'access-zones';

import {
  type PaginatedResult,
  type SortDir,
  decodeCursor,
  encodeCursor,
} from '../../utils/db';

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions?: Permission;
}

type RoleCursor = { value: string; id: string };

/**
 * Get roles for a profile or global roles with cursor-based pagination.
 * - If profileId is provided: returns only roles specific to that profile
 * - If no profileId: returns only global roles (profileId IS NULL)
 * - If zoneName is provided: includes permission for that zone
 */
export const getRoles = async (params?: {
  profileId?: string;
  zoneName?: string;
  cursor?: string | null;
  limit?: number;
  dir?: SortDir;
}): Promise<PaginatedResult<Role>> => {
  const {
    profileId = null,
    zoneName,
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
      : isNull(accessRoleCols.profileId);

    return cursorCondition
      ? and(profileCondition, cursorCondition)!
      : profileCondition;
  };

  // Use join-based query when zoneName is provided for DB-level filtering
  if (zoneName) {
    const rows = await db
      .select({
        id: accessRoles.id,
        name: accessRoles.name,
        description: accessRoles.description,
        permission: accessRolePermissionsOnAccessZones.permission,
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
