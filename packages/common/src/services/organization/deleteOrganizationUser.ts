import { db, eq, and } from '@op/db/client';
import { organizationUsers } from '@op/db/schema';
import { assertAccess, permission } from 'access-zones';
import type { User } from '@supabase/supabase-js';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser } from '../access';

export interface DeleteOrganizationUserParams {
  organizationUserId: string;
  organizationId: string;
  user: User;
}

export async function deleteOrganizationUser({
  organizationUserId,
  organizationId,
  user,
}: DeleteOrganizationUserParams) {
  if (!user) {
    throw new UnauthorizedError();
  }

  // Get the org access user and assert admin UPDATE permissions
  const orgUser = await getOrgAccessUser({ user, organizationId });

  if (!orgUser) {
    throw new UnauthorizedError('You are not a member of this organization');
  }

  assertAccess({ admin: permission.UPDATE }, orgUser?.roles || []);

  // Check if the organization user to delete exists
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

  // Prevent users from deleting themselves
  if (targetOrgUser.authUserId === user.id) {
    throw new UnauthorizedError('You cannot remove yourself from the organization');
  }

  // Delete the organization user
  // The cascade delete will handle removing role assignments automatically
  const [deletedUser] = await db
    .delete(organizationUsers)
    .where(
      and(
        eq(organizationUsers.id, organizationUserId),
        eq(organizationUsers.organizationId, organizationId)
      )
    )
    .returning();

  if (!deletedUser) {
    throw new NotFoundError('Failed to delete organization user');
  }

  return deletedUser;
}