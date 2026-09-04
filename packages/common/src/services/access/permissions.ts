import { invalidateMultiple } from '@op/cache';
import { type DbClient, db as defaultDb } from '@op/db/client';
import {
  accessRolePermissionsOnAccessZones,
  accessRoles,
  organizationUserToAccessRoles,
  profileUserToAccessRoles,
  profileUsers,
} from '@op/db/schema';
import { permission, toBitField } from 'access-zones';
import { and, eq } from 'drizzle-orm';

import { CommonError, NotFoundError, ValidationError } from '../../utils';
import { assertProfileAdmin } from '../assert';
import { profileUserCacheKey } from './cacheKeys';

export async function invalidateProfileUserCacheForRole(roleId: string) {
  const affectedUsers = await defaultDb
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
        paramsList: affectedUsers.map((u) =>
          profileUserCacheKey({
            user: { id: u.authUserId },
            profileId: u.profileId,
          }),
        ),
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

/**
 * Authorizes a permission-row write on a role and resolves the scope the row
 * is written under. Rows on profile-scoped roles are always global (NULL) —
 * the role itself is the scope — while global roles take per-profile override
 * rows and require an explicit `profileId` (the global baseline of a global
 * role is not editable).
 */
export async function assertPermissionRowScope({
  role,
  profileId,
  user,
}: {
  role: { profileId: string | null };
  profileId?: string;
  user: { id: string };
}): Promise<string | null> {
  if (role.profileId) {
    if (profileId && profileId !== role.profileId) {
      throw new ValidationError(
        'profileId does not match the profile of the role',
      );
    }
    await assertProfileAdmin({ user, profileId: role.profileId });
    return null;
  }

  if (!profileId) {
    throw new ValidationError('Cannot modify permissions for global roles');
  }

  await assertProfileAdmin({ user, profileId });
  return profileId;
}

export async function createRole({
  name,
  zoneName,
  permissions,
  description,
  profileId,
  user,
  db = defaultDb,
}: {
  name: string;
  zoneName: string;
  permissions: Permissions;
  description?: string;
  profileId: string;
  user: { id: string };
  db?: DbClient;
}) {
  const [zone] = await Promise.all([
    db.query.accessZones.findFirst({
      where: { name: zoneName },
    }),
    assertProfileAdmin({ user, profileId }),
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
        .where(
          and(
            eq(accessRolePermissionsOnAccessZones.accessRoleId, role.id),
            eq(accessRolePermissionsOnAccessZones.accessZoneId, zone.id),
          ),
        );
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
 * Update the permission for a role on a specific zone.
 */
export async function updateRolePermissions({
  roleId,
  zoneName,
  permissions,
  user,
  profileId,
}: {
  roleId: string;
  zoneName: string;
  permissions: Permissions;
  user: { id: string };
  profileId?: string;
}) {
  const [zone, role] = await Promise.all([
    defaultDb.query.accessZones.findFirst({
      where: { name: zoneName },
    }),
    defaultDb.query.accessRoles.findFirst({
      where: { id: roleId },
    }),
  ]);

  if (!zone) {
    throw new NotFoundError('Zone', zoneName);
  }

  if (!role) {
    throw new NotFoundError('Role', roleId);
  }

  const rowProfileId = await assertPermissionRowScope({
    role,
    profileId,
    user,
  });

  const bitfield = toBitField(permissions);

  const existing =
    await defaultDb.query.accessRolePermissionsOnAccessZones.findFirst({
      where: {
        accessRoleId: roleId,
        accessZoneId: zone.id,
        profileId: rowProfileId ?? { isNull: true },
      },
    });

  if (existing) {
    await defaultDb
      .update(accessRolePermissionsOnAccessZones)
      .set({ permission: bitfield })
      .where(eq(accessRolePermissionsOnAccessZones.id, existing.id));
  } else {
    await defaultDb.insert(accessRolePermissionsOnAccessZones).values({
      accessRoleId: roleId,
      accessZoneId: zone.id,
      permission: bitfield,
      profileId: rowProfileId,
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
  const role = await defaultDb.query.accessRoles.findFirst({
    where: { id: roleId },
  });

  if (!role) {
    throw new NotFoundError('Role', roleId);
  }

  if (!role.profileId) {
    throw new CommonError('Cannot update global roles');
  }

  await assertProfileAdmin({ user, profileId: role.profileId });

  const [updated] = await defaultDb
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
  const role = await defaultDb.query.accessRoles.findFirst({
    where: { id: roleId },
  });

  if (!role) {
    throw new NotFoundError('Role', roleId);
  }

  if (!role.profileId) {
    throw new CommonError('Cannot delete global roles');
  }

  await assertProfileAdmin({ user, profileId: role.profileId });

  // Invalidate before delete (cascade will remove the join rows we query)
  await invalidateProfileUserCacheForRole(roleId);

  // Delete the role (cascade will handle permissions)
  await defaultDb.delete(accessRoles).where(eq(accessRoles.id, roleId));

  return { deletedId: roleId };
}

export async function assignRoleToUser(
  organizationUserId: string,
  roleId: string,
) {
  return await defaultDb
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
  return await defaultDb
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
