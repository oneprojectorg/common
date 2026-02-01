import { and, asc, db, desc, eq, gt, isNull, lt, or } from '@op/db/client';
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
 * - If zoneName is provided: includes permission bitfield for that zone
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

  // ORDER BY name, id - compound condition for consistent pagination
  const cursorCondition = decodedCursor
    ? or(
        compareFn(accessRoles.name, decodedCursor.value),
        and(
          eq(accessRoles.name, decodedCursor.value),
          compareFn(accessRoles.id, decodedCursor.id),
        ),
      )
    : undefined;

  // Profile condition: either specific profile or global roles (NULL)
  const profileCondition = profileId
    ? eq(accessRoles.profileId, profileId)
    : isNull(accessRoles.profileId);

  const whereCondition = cursorCondition
    ? and(profileCondition, cursorCondition)
    : profileCondition;

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
      .where(whereCondition)
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
  const roles = await db._query.accessRoles.findMany({
    where: () => whereCondition,
    orderBy: (table, { asc, desc }) => {
      const orderFn = dir === 'desc' ? desc : asc;
      return [orderFn(table.name), orderFn(table.id)];
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
