import { checkPermission, permission } from 'access-zones';

import { getProfileAccessRoles } from '../access';

/**
 * True when a visitor with no account can read this decision — i.e. the public
 * sentinel resolves `decisions:READ` on the decision's own profile.
 *
 * Resolved through the same path the runtime authorizes with (an undefined
 * caller resolves to the public sentinel alone) rather than re-deriving which
 * rows add up to "public", so the admin screen can never disagree with what a
 * visitor actually gets.
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
