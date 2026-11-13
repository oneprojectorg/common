import { checkPermission, permission } from 'access-zones';

import { type AccessUser, getProfileAccessRoles } from '../access';
import { decisionPermission } from './permissions';

export type ProposalDevelopAccess = {
  isAdmin: boolean;
  canDevelop: boolean;
};

const ADMIN_ACCESS = [
  { profile: permission.ADMIN },
  { decisions: permission.ADMIN },
];

/**
 * The caller's develop access on a decision profile, without the phase:
 * an admin of the profile, or a holder of
 * `decisionPermission.DEVELOP_PROPOSALS`. No org fallback.
 */
export async function getProposalDevelopAccess({
  profileId,
  user,
}: {
  profileId: string | null;
  user: AccessUser;
}): Promise<ProposalDevelopAccess> {
  if (!profileId) {
    return { isAdmin: false, canDevelop: false };
  }

  const roles = await getProfileAccessRoles({ user, profileId });
  const isAdmin = checkPermission(ADMIN_ACCESS, roles);

  return {
    isAdmin,
    canDevelop:
      isAdmin ||
      checkPermission(
        { decisions: decisionPermission.DEVELOP_PROPOSALS },
        roles,
      ),
  };
}
