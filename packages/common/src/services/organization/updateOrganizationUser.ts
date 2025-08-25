import { db, eq, inArray } from '@op/db/client';
import { organizationUsers, organizationUserToAccessRoles, accessRoles } from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';
import type { User } from '@supabase/supabase-js';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

export interface UpdateOrganizationUserData {
  name?: string;
  email?: string;
  about?: string;
  roleIds?: string[];
}

export interface UpdateOrganizationUserParams {
  organizationUserId: string;
  organizationId: string;
  data: UpdateOrganizationUserData;
  user: User;
}

export async function updateOrganizationUser({
  organizationUserId,
  organizationId,
  data,
  user,
}: UpdateOrganizationUserParams) {
  if (!user) {
    throw new UnauthorizedError();
  }

  // Get the org access user and assert admin UPDATE permissions
  const orgUser = await getOrgAccessUser({ user, organizationId });

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  assertAccess({ admin: permission.UPDATE }, orgUser?.roles || []);

  // Check if the organization user to update exists
  const targetOrgUser = await db.query.organizationUsers.findFirst({
    where: (table, { eq, and }) =>
      and(
        eq(table.id, organizationUserId),
        eq(table.organizationId, organizationId)
      ),
  });

  if (!targetOrgUser) {
    throw new NotFoundError('Organization user not found');
  }

  // Update the organization user basic info
  const updateData: Partial<UpdateOrganizationUserData> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.about !== undefined) updateData.about = data.about;

  if (Object.keys(updateData).length > 0) {
    await db
      .update(organizationUsers)
      .set({
        ...updateData,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(organizationUsers.id, organizationUserId));
  }

  // Handle role updates if roleIds are provided
  if (data.roleIds !== undefined) {
    // Validate that all provided role IDs exist
    if (data.roleIds.length > 0) {
      const existingRoles = await db
        .select({ id: accessRoles.id })
        .from(accessRoles)
        .where(inArray(accessRoles.id, data.roleIds));

      if (existingRoles.length !== data.roleIds.length) {
        throw new NotFoundError('One or more role IDs are invalid');
      }
    }

    // Remove existing role assignments
    await db
      .delete(organizationUserToAccessRoles)
      .where(eq(organizationUserToAccessRoles.organizationUserId, organizationUserId));

    // Add new role assignments
    if (data.roleIds.length > 0) {
      await db
        .insert(organizationUserToAccessRoles)
        .values(
          data.roleIds.map((roleId) => ({
            organizationUserId,
            accessRoleId: roleId,
          }))
        );
    }
  }

  // Return the updated user with roles
  const updatedUserWithRoles = await db.query.organizationUsers.findFirst({
    where: (table, { eq }) => eq(table.id, organizationUserId),
    with: {
      roles: {
        with: {
          accessRole: true,
        },
      },
    },
  });

  if (!updatedUserWithRoles) {
    throw new NotFoundError('Failed to retrieve updated user');
  }

  return {
    ...updatedUserWithRoles,
    roles: updatedUserWithRoles.roles.map((role) => role.accessRole),
  };
}