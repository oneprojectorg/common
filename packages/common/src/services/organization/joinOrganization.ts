import { cache } from '@op/cache';
import { db, eq } from '@op/db/client';
import {
  accessRoles,
  organizationUserToAccessRoles,
  organizationUsers,
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

  // Retrieve the pre-mapped user to check for invite-based access
  const allowedUserEmail = await cache<ReturnType<typeof getAllowListUser>>({
    type: 'allowList',
    params: [user.email?.toLowerCase()],
    fetch: () => getAllowListUser({ email: user.email?.toLowerCase() }),
    options: {
      storeNulls: true,
      ttl: 30 * 60 * 1000,
    },
  });

  // Verify user's email domain matches organization domain
  const userEmailDomain = user.email.split('@')[1];
  if (userEmailDomain !== organization.domain) {
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

  // Determine the role to assign
  let targetRole;

  // If user joined via invite (allowedUserEmail exists), use the roleId from the invite
  if (
    allowedUserEmail?.metadata &&
    typeof allowedUserEmail.metadata === 'object'
  ) {
    const metadata = allowedUserEmail.metadata as { roleId?: string }; // JSON object fromt the DB

    if (metadata.roleId) {
      targetRole = await db.query.accessRoles.findFirst({
        where: eq(accessRoles.id, metadata.roleId),
      });
    }
  }

  // Fallback to Admin role for domain-based joins or if invited role doesn't exist
  if (!targetRole) {
    targetRole = await db.query.accessRoles.findFirst({
      where: (table, { eq }) => eq(table.name, 'Admin'),
    });

    if (!targetRole) {
      throw new CommonError('Role not found');
    }
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

    // Assign the determined role to the user
    if (newOrgUser) {
      await tx.insert(organizationUserToAccessRoles).values({
        organizationUserId: newOrgUser.id,
        accessRoleId: targetRole.id,
      });

      // Update user's currentProfileId to this organization's profile if the user was invited as an admin
      // if (role[0]?.name.toLowerCase() === 'admin') {
      // await tx
      // .update(users)
      // .set({ currentProfileId: organization.profileId })
      // .where(eq(users.authUserId, user.id));
      // }
    }

    return newOrgUser;
  });
};
