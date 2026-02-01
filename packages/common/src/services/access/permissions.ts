import { db } from '@op/db/client';
import {
  accessRolePermissionsOnAccessZones,
  accessRoles,
  organizationUserToAccessRoles,
} from '@op/db/schema';
import { toBitField } from 'access-zones';
import { and, eq } from 'drizzle-orm';

import { CommonError } from '../../utils';
import { assertProfileAdmin } from '../assert';

export type Permissions = {
  admin: boolean;
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
};

export async function createRole({
  name,
  zoneName,
  permissions,
  description,
  profileId,
  user,
}: {
  name: string;
  zoneName: string;
  permissions: Permissions;
  description?: string;
  profileId: string;
  user: { id: string };
}) {
  const [zone] = await Promise.all([
    db._query.accessZones.findFirst({
      where: (table, { eq }) => eq(table.name, zoneName),
    }),
    assertProfileAdmin(user, profileId),
  ]);

  if (!zone) {
    throw new CommonError(`Zone "${zoneName}" not found`);
  }

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

    // Create permission entry for the specified zone
    await tx.insert(accessRolePermissionsOnAccessZones).values({
      accessRoleId: role.id,
      accessZoneId: zone.id,
      permission: toBitField(permissions),
    });

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissions,
    };
  });
}

/**
 * Update the permission for a role on a specific zone
 */
export async function updateRolePermissions({
  roleId,
  zoneName,
  permissions,
  user,
}: {
  roleId: string;
  zoneName: string;
  permissions: Permissions;
  user: { id: string };
}) {
  const [zone, role] = await Promise.all([
    db._query.accessZones.findFirst({
      where: (table, { eq }) => eq(table.name, zoneName),
    }),
    db._query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.id, roleId),
    }),
  ]);

  if (!zone) {
    throw new CommonError(`Zone "${zoneName}" not found`);
  }

  if (!role) {
    throw new CommonError('Role not found');
  }

  if (!role.profileId) {
    throw new CommonError('Cannot modify permissions for global roles');
  }

  await assertProfileAdmin(user, role.profileId);

  // Convert boolean permissions to bitfield
  const bitfield = toBitField(permissions);

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
      .set({ permission: bitfield })
      .where(eq(accessRolePermissionsOnAccessZones.id, existing.id));
  } else {
    await db.insert(accessRolePermissionsOnAccessZones).values({
      accessRoleId: roleId,
      accessZoneId: zone.id,
      permission: bitfield,
    });
  }

  return role;
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

  return { success: true, deletedId: roleId };
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
