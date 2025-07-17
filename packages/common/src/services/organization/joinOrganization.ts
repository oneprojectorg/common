import { cache } from '@op/cache';
import { db, eq } from '@op/db/client';
import {
  organizationUserToAccessRoles,
  organizationUsers,
  users,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, NotFoundError, UnauthorizedError } from '../../utils';
import { getAllowListUser } from '../user';

export const joinOrganization = async ({
  user,
  organizationId,
}: {
  user: User;
  organizationId: string;
}) => {
  if (!user?.email) {
    throw new Error('User email is required');
  }

  // Verify the organization exists and has a domain that matches the user's email
  const organization = await db.query.organizations.findFirst({
    where: (table, { eq }) => eq(table.id, organizationId),
  });

  if (!organization) {
    throw new NotFoundError('Organization not found');
  }

  // Verify user's email domain matches organization domain
  const userEmailDomain = user.email.split('@')[1];
  if (userEmailDomain !== organization.domain) {
    // Retrieve the pre-mapped user to verify that we can still join without domian mapping
    const allowedUserEmail = await cache<ReturnType<typeof getAllowListUser>>({
      type: 'allowList',
      params: [user.email?.toLowerCase()],
      fetch: () => getAllowListUser({ email: user.email?.toLowerCase() }),
      options: {
        storeNulls: true,
        ttl: 30 * 60 * 1000,
      },
    });

    if (
      !allowedUserEmail?.organizationId ||
      allowedUserEmail?.organizationId !== organizationId
    ) {
      throw new UnauthorizedError(
        'Your email does not have access to join this organization',
      );
    }
  }

  // Check if user is already a member of this organization
  const existingMembership = await db.query.organizationUsers.findFirst({
    where: (table, { and, eq }) =>
      and(
        eq(table.authUserId, user.id),
        eq(table.organizationId, organizationId),
      ),
  });

  if (existingMembership) {
    // just return the user since they've already joined
    return { id: existingMembership.id };
  }

  // Get the Admin role (default role for domain-based joins)
  const adminRole = await db.query.accessRoles.findFirst({
    where: (table, { eq }) => eq(table.name, 'Admin'),
  });

  if (!adminRole) {
    throw new CommonError('Role not found');
  }

  return await db.transaction(async (tx) => {
    // Create organizationUser record
    const [newOrgUser] = await tx
      .insert(organizationUsers)
      .values({
        organizationId,
        authUserId: user.id,
        email: user.email!,
        name: user.user_metadata?.full_name || user.email!.split('@')[0],
      })
      .returning();

    // Assign Admin role to the user
    if (newOrgUser) {
      await tx.insert(organizationUserToAccessRoles).values({
        organizationUserId: newOrgUser.id,
        accessRoleId: adminRole.id,
      });
    }

    // Update user's currentProfileId to this organization's profile
    await tx
      .update(users)
      .set({ currentProfileId: organization.profileId })
      .where(eq(users.authUserId, user.id));

    return newOrgUser;
  });
};
