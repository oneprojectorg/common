import { cache } from '@op/cache';
import { db, eq } from '@op/db/client';
import {
  type AccessRole,
  type Organization,
  OrganizationUser,
  accessRoles,
  organizationUserToAccessRoles,
  organizationUsers,
} from '@op/db/schema';
import { User } from '@op/supabase/lib';

import { CommonError, UnauthorizedError } from '../../utils';
import { getAllowListUser } from '../user';

/**
 * Adds a user to an organization with the specified or default role.
 * Verifies email domain match or allowList authorization before joining.
 * Returns existing membership if user is already a member.
 */
export const joinOrganization = async ({
  user,
  organization,
}: {
  user: User;
  organization: Organization;
}): Promise<OrganizationUser> => {
  if (!user.email) {
    throw new CommonError('User email is required');
  }

  const userEmailDomainPart = user.email.split('@')[1];
  if (!userEmailDomainPart) {
    throw new CommonError('User email is invalid');
  }

  const userEmailDomain = userEmailDomainPart.toLocaleLowerCase();

  // Check if user is already a member of this organization and if they are on the allow list
  const [existingMembership, allowListUser] = await Promise.all([
    db.query.organizationUsers.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, user.id),
          eq(table.organizationId, organization.id),
        ),
    }),
    cache<ReturnType<typeof getAllowListUser>>({
      type: 'allowList',
      params: [userEmailDomain],
      fetch: () => getAllowListUser({ email: userEmailDomain }),
      options: {
        storeNulls: true,
        ttl: 30 * 60 * 1000,
      },
    }),
  ]);

  if (existingMembership) {
    return existingMembership;
  }

  if (!organization.domain) {
    throw new CommonError('Organization does not have a domain set');
  }

  // Verify user's email domain matches organization domain
  if (userEmailDomain !== organization.domain.toLocaleLowerCase()) {
    if (
      !allowListUser?.organizationId ||
      allowListUser?.organizationId !== organization.id
    ) {
      throw new UnauthorizedError(
        'Your email does not have access to join this organization',
      );
    }
  }

  // Determine the role to assign
  const targetRole = await determineTargetRole(allowListUser?.metadata?.roleId);

  return await db.transaction<OrganizationUser>(async (tx) => {
    // Create organizationUser record
    const [newOrgUser] = await tx
      .insert(organizationUsers)
      .values({
        organizationId: organization.id,
        authUserId: user.id,
        email: user.email!,
        name: user.user_metadata?.full_name || userEmailDomain,
      })
      .returning();

    if (!newOrgUser) {
      throw new CommonError('Failed to add user to organization');
    }

    await tx.insert(organizationUserToAccessRoles).values({
      organizationUserId: newOrgUser.id,
      accessRoleId: targetRole.id,
    });

    return newOrgUser;
  });
};

/**
 * Determines which role to assign to a user joining an organization.
 * If a roleId is provided and exists, that role is used.
 * Otherwise, falls back to the "Member" role.
 */
const determineTargetRole = async (
  roleId?: AccessRole['id'],
): Promise<AccessRole> => {
  if (roleId) {
    const role = await db.query.accessRoles.findFirst({
      where: eq(accessRoles.id, roleId),
    });

    if (role) {
      return role;
    }
  }

  const memberRole = await db.query.accessRoles.findFirst({
    where: (table, { eq }) => eq(table.name, 'Member'),
  });

  if (!memberRole) {
    throw new CommonError('Role not found');
  }

  return memberRole;
};
