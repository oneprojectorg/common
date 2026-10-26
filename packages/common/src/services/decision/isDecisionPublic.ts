import { checkPermission, permission } from 'access-zones';

import { getProfileAccessRoles } from '../access';

/**
 * Whether a visitor with no account holds `permissions` on this decision
 * (default: read). An undefined caller resolves to the public sentinel alone,
 * so this is the grant a visitor gets.
 */
export const isDecisionPublic = async ({
  profileId,
  permissions = { decisions: permission.READ },
}: {
  profileId: string;
  permissions?: Parameters<typeof checkPermission>[0];
}): Promise<boolean> => {
  const publicRoles = await getProfileAccessRoles({
    user: undefined,
    profileId,
  });

  return checkPermission(permissions, publicRoles);
};
