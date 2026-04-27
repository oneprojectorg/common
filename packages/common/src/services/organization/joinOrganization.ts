import { cache } from '@op/cache';
import { type DbClient, and, db as defaultDb, eq } from '@op/db/client';
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
  db = defaultDb,
}: {
  user: CommonUser;
  organization: Organization;
  /** If provided the allowlist checks are skipped and this role is assigned */
  roleId?: AccessRole['id'];
  db?: DbClient;
}): Promise<OrganizationUser> => {
  const userEmailDomainPart = user.email.split('@')[1];
  if (!userEmailDomainPart) {
    throw new CommonError('User email is invalid');
  }

  const userEmailDomain = userEmailDomainPart.toLowerCase();

  // Check if user is already a member of this organization and if they are on the allow list
  const [existingMembership, allowListUser] = await Promise.all([
    db
      .select()
      .from(organizationUsers)
      .where(
        and(
          eq(organizationUsers.authUserId, user.authUserId),
          eq(organizationUsers.organizationId, organization.id),
        ),
      )
      .limit(1)
      .then(([row]) => row),
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
  if (!roleId && userEmailDomain !== organization.domain?.toLowerCase()) {
    if (
      !allowListUser?.organizationId ||
      allowListUser?.organizationId !== organization.id
    ) {
      throw new UnauthorizedError(
        'Your email does not have access to join this organization',
      );
    }
  }

  const targetRole = await determineTargetRole(
    roleId ?? allowListUser?.metadata?.roleId,
    db,
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
 */
const determineTargetRole = async (
  roleId: AccessRole['id'] | undefined,
  db: DbClient,
): Promise<AccessRole> => {
  if (roleId) {
    const role = await db.query.accessRoles.findFirst({
      where: { id: roleId },
    });

    if (role) {
      return role;
    }
  }

  return assertGlobalRole('Member', db);
};
