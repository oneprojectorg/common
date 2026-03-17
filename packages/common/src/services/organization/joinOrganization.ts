import { cache } from '@op/cache';
import { db } from '@op/db/client';
import {
  type AccessRole,
  type CommonUser,
  type Organization,
  OrganizationUser,
  organizationUserToAccessRoles,
  organizationUsers,
} from '@op/db/schema';

import { CommonError, UnauthorizedError } from '../../utils';
import { assertGlobalRole } from '../assert';
import { getAllowListUser } from '../user';

/**
 * Adds a user to an organization with the specified or default role.
 * Verifies email domain match or allowList authorization before joining.
 * Returns existing membership if user is already a member.
 */
export const joinOrganization = async ({
  user,
  organization,
  roleId,
}: {
  user: CommonUser;
  organization: Organization;
  /** If provided the allowlist checks are skipped and this role is assigned */
  roleId?: AccessRole['id'];
}): Promise<OrganizationUser> => {
  const userEmailDomainPart = user.email.split('@')[1];
  if (!userEmailDomainPart) {
    throw new CommonError('User email is invalid');
  }

  const userEmailDomain = userEmailDomainPart.toLocaleLowerCase();

  // Check if user is already a member of this organization and if they are on the allow list
  const [existingMembership, allowListUser] = await Promise.all([
    db._query.organizationUsers.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.authUserId, user.authUserId),
          eq(table.organizationId, organization.id),
        ),
    }),
    roleId
      ? null
      : cache<ReturnType<typeof getAllowListUser>>({
          type: 'allowList',
          params: [userEmailDomain],
          fetch: () => getAllowListUser({ email: user.email }),
          options: {
            skipMemCache: true,
            ttl: 30 * 60 * 1000,
          },
        }),
  ]);

  if (existingMembership) {
    return existingMembership;
  }

  // Verify user's email domain matches organization domain
  if (!roleId && userEmailDomain !== organization.domain?.toLocaleLowerCase()) {
    if (
      !allowListUser?.organizationId ||
      allowListUser?.organizationId !== organization.id
    ) {
      throw new UnauthorizedError(
        'Your email does not have access to join this organization',
      );
    }
  }

  // Resolve the target role before opening the transaction — assertGlobalRole
  // uses the global db pool and must not be called inside a transaction callback,
  // as that would require a second connection while one is already held by the
  // transaction, which can exhaust the connection pool in serverless environments.
  const targetRole = await determineTargetRole(
    roleId ?? allowListUser?.metadata?.roleId,
  );

  return await db.transaction<OrganizationUser>(async (tx) => {
    const [newOrgUser] = await tx
      .insert(organizationUsers)
      .values({
        organizationId: organization.id,
        authUserId: user.authUserId,
        email: user.email,
        name: user.name ?? userEmailDomain,
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
 * If a roleId is provided and exists in the DB, that role is used.
 * Otherwise, falls back to the global "Member" role.
 *
 * Must be called OUTSIDE a transaction to avoid acquiring a second DB
 * connection while one is already held by the transaction.
 */
const determineTargetRole = async (
  roleId?: AccessRole['id'],
): Promise<AccessRole> => {
  if (roleId) {
    const role = await db.query.accessRoles.findFirst({
      where: { id: roleId },
    });

    if (role) {
      return role;
    }
  }

  return assertGlobalRole('Member');
};
