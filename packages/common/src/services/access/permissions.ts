import { invalidateMultiple } from '@op/cache';
import { db } from '@op/db/client';
import {
  accessRolePermissionsOnAccessZones,
  accessRoles,
  organizationUserToAccessRoles,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import { permission, toBitField } from 'access-zones';
import { and, eq } from 'drizzle-orm';

import { CommonError, NotFoundError } from '../../utils';
import { assertProfileAdmin } from '../assert';

export async function invalidateProfileUserCacheForRole(roleId: string) {
  const affectedUsers = await db
    .select({
      profileId: profileUsers.profileId,
      authUserId: profileUsers.authUserId,
    })
    .from(profileUserToAccessRoles)
    .innerJoin(
      profileUsers,
      eq(profileUserToAccessRoles.profileUserId, profileUsers.id),
    )
    .where(eq(profileUserToAccessRoles.accessRoleId, roleId));

  if (affectedUsers.length > 0) {
    await Promise.all([
      invalidateMultiple({
        type: 'profileUser',
        paramsList: affectedUsers.map((u) => [u.profileId, u.authUserId]),
      }),
      invalidateMultiple({
        type: 'user',
        paramsList: affectedUsers.map((u) => [u.authUserId]),
      }),
    ]);
  }
}

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
    db.query.accessZones.findFirst({
      where: { name: zoneName },
    }),
    assertProfileAdmin(user, profileId),
  ]);

  if (!zone) {
    throw new NotFoundError('Zone', zoneName);
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

    // Scoped roles always get profile READ
    if (zoneName !== 'profile') {
      const profileZone = await tx.query.accessZones.findFirst({
        where: { name: 'profile' },
      });

      if (profileZone) {
        await tx.insert(accessRolePermissionsOnAccessZones).values({
          accessRoleId: role.id,
          accessZoneId: profileZone.id,
          permission: permission.READ,
        });
      }
    } else if (!permissions.read) {
      // If creating on the profile zone but read wasn't set, force it
      await tx
        .update(accessRolePermissionsOnAccessZones)
        .set({ permission: toBitField({ ...permissions, read: true }) })
        .where(eq(accessRolePermissionsOnAccessZones.accessRoleId, role.id));
    }

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
    db.query.accessZones.findFirst({
      where: { name: zoneName },
    }),
    db.query.accessRoles.findFirst({
      where: { id: roleId },
    }),
  ]);

  if (!zone) {
    throw new NotFoundError('Zone', zoneName);
  }

  if (!role) {
    throw new NotFoundError('Role', roleId);
  }

  if (!role.profileId) {
    throw new CommonError('Cannot modify permissions for global roles');
  }

  await assertProfileAdmin(user, role.profileId);

  const bitfield = toBitField(permissions);

  const existing = await db.query.accessRolePermissionsOnAccessZones.findFirst({
    where: { accessRoleId: roleId, accessZoneId: zone.id },
  });

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

  await invalidateProfileUserCacheForRole(roleId);

  return role;
}

/**
 * Update a role's name (only profile-specific roles can be updated)
 */
export async function updateRole({
  roleId,
  name,
  user,
}: {
  roleId: string;
  name: string;
  user: { id: string };
}) {
  const role = await db.query.accessRoles.findFirst({
    where: { id: roleId },
  });

  if (!role) {
    throw new NotFoundError('Role', roleId);
  }

  if (!role.profileId) {
    throw new CommonError('Cannot update global roles');
  }

  await assertProfileAdmin(user, role.profileId);

  const [updated] = await db
    .update(accessRoles)
    .set({ name })
    .where(eq(accessRoles.id, roleId))
    .returning();

  if (!updated) {
    throw new CommonError('Could not update role');
  }

  return { id: updated.id, name: updated.name };
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
  const role = await db.query.accessRoles.findFirst({
    where: { id: roleId },
  });

  if (!role) {
    throw new NotFoundError('Role', roleId);
  }

  if (!role.profileId) {
    throw new CommonError('Cannot delete global roles');
  }

  await assertProfileAdmin(user, role.profileId);

  // Invalidate before delete (cascade will remove the join rows we query)
  await invalidateProfileUserCacheForRole(roleId);

  // Delete the role (cascade will handle permissions)
  await db.delete(accessRoles).where(eq(accessRoles.id, roleId));

  return { deletedId: roleId };
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
