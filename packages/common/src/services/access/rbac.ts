import { UnauthorizedError } from '@/src/utils';
import { accessRoles } from '@op/db/schema';

export type AccessRole = typeof accessRoles;

export const ACCESS_ZONES = ['organization', 'projects', 'posts'] as const;
export type AccessZone = (typeof ACCESS_ZONES)[number];

export const accessMasks = {
  CREATE: 0b1000,
  READ: 0b0100,
  UPDATE: 0b0010,
  DELETE: 0b0001,
  ADMIN: 0b1111,
};

export type AccessZonePermission = Partial<
  Record<(typeof ACCESS_ZONES)[number], number>
>;

// collapse all access roles into a single access bitset
export const collapseAccessRoles = (roles: Array<AccessRole>) =>
  roles
    .map((role) => role.access)
    .reduce(
      (accum, role) =>
        Object.entries(role).reduce((roleAccum, [key, val]) => {
          roleAccum[key as AccessZone] |= val;

          return roleAccum;
        }, accum),
      {} as Record<AccessZone, number>,
    );

export const hasAccess = (
  needed: AccessZonePermission,
  roles: Array<AccessRole>,
) => {
  const currentPermissions = collapseAccessRoles(roles);

  // Use a bitwise OR to check collapsed permissions satisfy "needed"
  return Object.entries(needed).every(
    ([section, neededAccessBits]: [string, number]) =>
      (neededAccessBits & currentPermissions[section as AccessZone]) ===
      neededAccessBits,
  );
};

export const assertAccess = (
  needed: AccessZonePermission,
  roles: Array<AccessRole>,
) => {
  if (!hasAccess(needed, roles)) {
    throw new UnauthorizedError('Not authenticated');
  }
};
