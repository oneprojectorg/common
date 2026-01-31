import { db } from '@op/db/client';
import {
  accessRolePermissionsOnAccessZones,
  accessRoles,
  accessZones,
  organizationUserToAccessRoles,
} from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';
import { and, eq } from 'drizzle-orm';

import { CommonError, UnauthorizedError } from '../../utils';
import { getProfileAccessUser } from './index';

async function assertProfileAdmin(user: { id: string }, profileId: string) {
  const profileUser = await getProfileAccessUser({ user, profileId });

  if (!profileUser) {
    throw new UnauthorizedError('You are not a member of this profile');
  }

  assertAccess({ profile: permission.ADMIN }, profileUser.roles || []);
}

export async function createRole({
  name,
  permissions,
  description,
  profileId,
  user,
}: {
  name: string;
  permissions: Record<string, number>;
  description?: string;
  profileId: string;
  user: { id: string };
}) {
  await assertProfileAdmin(user, profileId);

  return await db.transaction(async (tx) => {
    // Create the role
    const [role] = await tx
      .insert(accessRoles)
      .values({
        name,
        description,
        profileId,
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
      .map(([zoneName, perm]) => ({
        accessRoleId: role.id,
        accessZoneId: zoneMap.get(zoneName)!,
        permission: perm,
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
export async function updateRolePermissions({
  roleId,
  zoneName,
  permission: newPermission,
  user,
}: {
  roleId: string;
  zoneName: string;
  permission: number;
  user: { id: string };
}) {
  // Look up the zone by name
  const zone = await db._query.accessZones.findFirst({
    where: (table, { eq }) => eq(table.name, zoneName),
  });

  if (!zone) {
    throw new CommonError(`Zone "${zoneName}" not found`);
  }

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

  await assertProfileAdmin(user, role.profileId);

  // Upsert the permission entry
  const existing = await db._query.accessRolePermissionsOnAccessZones.findFirst(
    {
      where: (table, { eq, and }) =>
        and(eq(table.accessRoleId, roleId), eq(table.accessZoneId, zone.id)),
    },
  );

  if (existing) {
    await db
      .update(accessRolePermissionsOnAccessZones)
      .set({ permission: newPermission })
      .where(eq(accessRolePermissionsOnAccessZones.id, existing.id));
  } else {
    await db.insert(accessRolePermissionsOnAccessZones).values({
      accessRoleId: roleId,
      accessZoneId: zone.id,
      permission: newPermission,
    });
  }

  return { success: true };
}

/**
 * Delete a role (only profile-specific roles can be deleted)
 */
export async function deleteRole({
  roleId,
  user,
}: {
  roleId: string;
  user: { id: string };
}) {
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

  await assertProfileAdmin(user, role.profileId);

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
