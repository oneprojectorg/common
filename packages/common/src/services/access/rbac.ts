import { UnauthorizedError } from '@/src/utils';
import { accessRoles } from '@op/db/schema';

import { AccessZone, AccessZonePermission } from './types';

export type AccessRole = typeof accessRoles;

// 0bXXXXX - Admin, Create, Read, Update, Delete
export const accessMasks = {
  CREATE: 0b01000,
  READ: 0b00100,
  UPDATE: 0b00010,
  DELETE: 0b00001,
  ADMIN: 0b11111,
};

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

// utils
export const toBitField = (permission: AccessZonePermission): number => {
  const accessPermissionKeys = ['CREATE', 'READ', 'UPDATE', 'DELETE'] as const;

  const newPermission = accessPermissionKeys.reduce((accumPermissions, key) => {
    const permissionMask = permission[key] ? accessMasks[key] : 0;
    accumPermissions |= permissionMask;

    return accumPermissions;
  }, 0);

  return newPermission;
};

export const roleToBitField = (permissions) => {
  return Object.entries(permissions).reduce((accum, [name, permission]) => {
    accum[name] = toBitField(permission);
    return accum;
  }, {});
};

export const fromBitField = (bitField: number) => ({
  create: (accessMasks['CREATE'] & bitField) === accessMasks['CREATE'],
  read: (accessMasks['READ'] & bitField) === accessMasks['READ'],
  update: (accessMasks['UPDATE'] & bitField) === accessMasks['UPDATE'],
  delete: (accessMasks['DELETE'] & bitField) === accessMasks['DELETE'],
});
