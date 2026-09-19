import { checkPermission, permission } from 'access-zones';

import { getProfileAccessRoles } from '../access';

/**
 * Whether a visitor with no account can read this decision. An undefined caller
 * resolves to the public sentinel alone, so this is the grant a visitor gets.
 */
export const isDecisionPublic = async ({
  profileId,
}: {
  profileId: string;
}): Promise<boolean> => {
  const publicRoles = await getProfileAccessRoles({
    user: undefined,
    profileId,
  });

  return checkPermission({ decisions: permission.READ }, publicRoles);
};
