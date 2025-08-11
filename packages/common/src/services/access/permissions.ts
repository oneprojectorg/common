import { CommonError } from '@/src/utils';
import { db } from '@op/db/client';
import {
  accessRolePermissionsOnAccessZones,
  accessRoles,
  accessZones,
  organizationUserToAccessRoles,
} from '@op/db/schema';
import { and, eq } from 'drizzle-orm';

export async function createRole(
  name: string,
  permissions: Record<string, number>,
  description?: string,
) {
  return await db.transaction(async (tx) => {
    // Create the role
    const [role] = await tx
      .insert(accessRoles)
      .values({
        name,
        description,
      })
      .returning();

    if (!role) {
      throw new CommonError('Could not create role');
    }

    // Get all zones
    const zones = await tx.select().from(accessZones);
    const zoneMap = new Map(zones.map((z) => [z.name, z.id]));

    // Create permission entries
    const permissionEntries = Object.entries(permissions)
      .filter(([zoneName]) => zoneMap.has(zoneName))
      .map(([zoneName, permission]) => ({
        accessRoleId: role.id,
        accessZoneId: zoneMap.get(zoneName)!,
        permission,
      }));

    if (permissionEntries.length > 0) {
      await tx
        .insert(accessRolePermissionsOnAccessZones)
        .values(permissionEntries);
    }

    return role;
  });
}

export async function assignRoleToUser(
  organizationUserId: string,
  roleId: string,
) {
  return await db
    .insert(organizationUserToAccessRoles)
    .values({
      organizationUserId,
      accessRoleId: roleId,
    })
    .onConflictDoNothing();
}

/**
 * Remove a role from an organization user
 */
export async function removeRoleFromUser(
  organizationUserId: string,
  roleId: string,
) {
  return await db
    .delete(organizationUserToAccessRoles)
    .where(
      and(
        eq(
          organizationUserToAccessRoles.organizationUserId,
          organizationUserId,
        ),
        eq(organizationUserToAccessRoles.accessRoleId, roleId),
      ),
    );
}
