import { invalidate } from '@op/cache';
import { and, db, eq } from '@op/db/client';
import { organizationUsers } from '@op/db/schema';
import type { User } from '@supabase/supabase-js';
import { permission } from 'access-zones';

import { NotFoundError, UnauthorizedError } from '../../utils';
import { getOrgAccessUser, orgUserCacheKey } from '../access';
import { assertOrgAccess } from '../assert';

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
  // Assert the user has admin UPDATE permissions on the organization
  await assertOrgAccess({
    user,
    organizationId,
    permissions: { admin: permission.UPDATE },
  });

  // Check if the organization user to delete exists
  const targetOrgUser = await db.query.organizationUsers.findFirst({
    where: {
      id: organizationUserId,
      organizationId,
    },
  });

  if (!targetOrgUser) {
    throw new NotFoundError('Organization user', organizationUserId);
  }

  // Prevent users from deleting themselves
  if (targetOrgUser.authUserId === user.id) {
    throw new UnauthorizedError(
      'You cannot remove yourself from the organization',
    );
  }

  // Delete the organization user
  // The cascade delete will handle removing role assignments automatically
  const [deletedUser] = await db
    .delete(organizationUsers)
    .where(
      and(
        eq(organizationUsers.id, organizationUserId),
        eq(organizationUsers.organizationId, organizationId),
      ),
    )
    .returning();

  // Invalidate the TARGET user's cache, not the caller's — `orgUserCacheKey`
  // partitions entries by caller identity, so passing the admin here would
  // leave the removed member's [orgId, B.id:GLOBAL_USER_PUBLIC] entry alive
  // until the 72h TTL expires, letting a removed admin retain access for days.
  const targetAccessUser = { id: targetOrgUser.authUserId };
  await invalidate({
    type: 'orgUser',
    params: orgUserCacheKey({
      user: targetAccessUser,
      organizationId,
    }),
  });
  getOrgAccessUser.invalidate({ user: targetAccessUser, organizationId });

  if (!deletedUser) {
    throw new NotFoundError('Organization user', organizationUserId);
  }

  return deletedUser;
}
