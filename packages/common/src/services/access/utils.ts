import { AccessZoneSchema, NormalizedRole } from 'access-zones';
import { z } from 'zod';

type AccessZone = z.infer<typeof AccessZoneSchema>;

// Manual type definition to work around Zod 3->4 upgrade incompatibility
// Schema: { accessRoleId: string, accessZoneId: string, permission: number }
type AccessRolePermissionOnAccessZone = {
  accessRoleId: string;
  accessZoneId: string;
  permission: number;
};

interface ZonePermission extends AccessRolePermissionOnAccessZone {
  accessZone: AccessZone;
}

interface AccessRole {
  id: string;
  name: string;
  description?: string;
  zonePermissions?: ZonePermission[];
}

// Primary interface for when we have the exact structure
export interface RoleJunction {
  organizationUserId: string;
  accessRoleId: string;
  accessRole: AccessRole;
}

// For Drizzle query results that we know have the right structure but TypeScript can't verify
export const getNormalizedRoles = (
  roleJunctions: Array<{ accessRole: AccessRole }>,
): NormalizedRole[] =>
  roleJunctions.map((roleJunction) => {
    const role = roleJunction.accessRole;

    // Build the access object with zone names as keys and permission bitfields as values
    const access: Record<string, number> = {};

    if (role.zonePermissions) {
      role.zonePermissions.forEach((zonePermission: ZonePermission) => {
        // Use zone name as key, permission bitfield as value
        access[zonePermission.accessZone.name] = zonePermission.permission;
      });
    }

    return {
      id: role.id,
      name: role.name,
      access,
    };
  });
