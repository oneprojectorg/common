import { db, eq } from '@op/db/client';
import { organizations } from '@op/db/schema';
import { checkPermission, collapseRoles, permission } from 'access-zones';
import type { NormalizedRole } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { type AccessUser, getOrgAccessUser } from '../access';
import type { DecisionRolePermissions } from './permissions';
import { fromDecisionBitField } from './permissions';

const ALL_TRUE_ACCESS: DecisionRolePermissions = {
  delete: true,
  update: true,
  read: true,
  create: true,
  admin: true,
  inviteMembers: true,
  review: true,
  submitProposals: true,
  vote: true,
  developProposals: true,
};

const getRolesDecisionBits = (roles: NormalizedRole[]): number =>
  collapseRoles(roles)['decisions'] ?? 0;

/**
 * The user's decision capabilities on an instance, given the profile roles
 * `assertInstanceProfileAccess` returned for it.
 */
export const resolveInstanceAccess = async ({
  user,
  instance,
  profileRoles,
}: {
  user: AccessUser | undefined;
  instance: { profileId: string; ownerProfileId: string | null };
  profileRoles: NormalizedRole[];
}): Promise<DecisionRolePermissions> => {
  if (profileRoles.length > 0) {
    // Profile admins bypass decision-zone role checks — they have full access
    if (checkPermission({ profile: permission.ADMIN }, profileRoles)) {
      return ALL_TRUE_ACCESS;
    }
    return fromDecisionBitField(getRolesDecisionBits(profileRoles));
  }

  // Fall back to org-level roles
  if (instance.ownerProfileId) {
    const [org] = await db
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.profileId, instance.ownerProfileId));

    if (org?.id) {
      const orgUser = await getOrgAccessUser({ user, organizationId: org.id });
      if (orgUser) {
        return fromDecisionBitField(getRolesDecisionBits(orgUser.roles));
      }
    }
  }

  // This should be unreachable: assertInstanceProfileAccess guarantees the user
  // has either a profile or org role before resolveInstanceAccess is called.
  throw new UnauthorizedError("You don't have access to do this");
};
