import { db } from '@op/db/client';
import {
  accessRolePermissionsOnAccessZones,
  accessRoles,
  accessZones,
  organizationUserToAccessRoles,
} from '@op/db/schema';
import { and, eq } from 'drizzle-orm';

import { CommonError } from '../../utils';

export async function createRole(
  name: string,
  permissions: Record<string, number>,
  description?: string,
  profileId?: string,
) {
  return await db.transaction(async (tx) => {
    // Create the role
    const [role] = await tx
      .insert(accessRoles)
      .values({
        name,
        description,
        profileId: profileId ?? null,
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

/**
 * Update the permission for a role on a specific zone
 */
export async function updateRolePermissions(
  roleId: string,
  zoneId: string,
  permission: number,
) {
  // First check if the role is a global role (profileId IS NULL)
  const role = await db._query.accessRoles.findFirst({
    where: (table, { eq }) => eq(table.id, roleId),
  });

  if (!role) {
    throw new CommonError('Role not found');
  }

  if (!role.profileId) {
    throw new CommonError('Cannot modify permissions for global roles');
  }

  // Upsert the permission entry
  const existing = await db._query.accessRolePermissionsOnAccessZones.findFirst(
    {
      where: (table, { eq, and }) =>
        and(eq(table.accessRoleId, roleId), eq(table.accessZoneId, zoneId)),
    },
  );

  if (existing) {
    await db
      .update(accessRolePermissionsOnAccessZones)
      .set({ permission })
      .where(eq(accessRolePermissionsOnAccessZones.id, existing.id));
  } else {
    await db.insert(accessRolePermissionsOnAccessZones).values({
      accessRoleId: roleId,
      accessZoneId: zoneId,
      permission,
    });
  }

  return { success: true };
}

/**
 * Delete a role (only profile-specific roles can be deleted)
 */
export async function deleteRole(roleId: string) {
  // First check if the role is a global role (profileId IS NULL)
  const role = await db._query.accessRoles.findFirst({
    where: (table, { eq }) => eq(table.id, roleId),
  });

  if (!role) {
    throw new CommonError('Role not found');
  }

  if (!role.profileId) {
    throw new CommonError('Cannot delete global roles');
  }

  // Delete the role (cascade will handle permissions)
  await db.delete(accessRoles).where(eq(accessRoles.id, roleId));

  return { success: true };
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
