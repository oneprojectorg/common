import { and, db, eq, gt, lt, or } from '@op/db/client';
import { accessRoles } from '@op/db/schema';

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
}

type RoleCursor = { value: string; id: string };

/**
 * Get roles for a profile or global roles with cursor-based pagination.
 * - If profileId is provided: returns only roles specific to that profile
 * - If no profileId: returns only global roles (profileId IS NULL)
 */
export const getRoles = async (params?: {
  profileId?: string;
  cursor?: string | null;
  limit?: number;
  dir?: SortDir;
}): Promise<PaginatedResult<Role>> => {
  const { profileId = null, cursor, limit = 25, dir = 'asc' } = params ?? {};

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

  const roles = await db._query.accessRoles.findMany({
    where: (table, { isNull }) => {
      const profileCondition = profileId
        ? eq(table.profileId, profileId)
        : isNull(table.profileId);

      return cursorCondition
        ? and(profileCondition, cursorCondition)
        : profileCondition;
    },
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
  const items = resultItems.map((role) => ({
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

interface RoleWithPermissions {
  id: string;
  name: string;
  description: string | null;
  isGlobal: boolean;
  permission: number;
}

/**
 * Get roles with their permission bitfield for a specific profile and zone.
 * Returns both profile-specific roles and global roles.
 */
export const getRolesWithPermissions = async (params: {
  profileId: string;
  zoneId: string;
}): Promise<RoleWithPermissions[]> => {
  const { profileId, zoneId } = params;

  // Get all roles that are either global or specific to this profile
  const roles = await db._query.accessRoles.findMany({
    where: (table, { or, eq, isNull }) =>
      or(eq(table.profileId, profileId), isNull(table.profileId)),
    orderBy: (table, { asc }) => [asc(table.name)],
    with: {
      zonePermissions: {
        where: (permTable, { eq }) => eq(permTable.accessZoneId, zoneId),
      },
    },
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    isGlobal: !role.profileId,
    permission: role.zonePermissions[0]?.permission ?? 0,
  }));
};
