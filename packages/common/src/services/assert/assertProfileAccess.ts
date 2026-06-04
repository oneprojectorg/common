import { type AccessZonePermissionInput, checkPermission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import {
  type ProfileUserWithNormalizedRoles,
  getProfileAccessUser,
} from '../access';

/**
 * Fetches the user's roles on a profile and asserts the given permissions,
 * returning the resolved profile-access user so callers can reuse it.
 *
 * @param notMemberMessage - Optional message for the thrown exception when the
 *   user has no role on the profile. Defaults to 'Not authorized'.
 * @throws UnauthorizedError if the user is not a member of the profile or their
 *   roles don't satisfy the permissions — every denial throws the same
 *   exception type (only the message differs when `notMemberMessage` is given).
 */
export async function assertProfileAccess({
  user,
  profileId,
  permissions,
  notMemberMessage,
}: {
  user: { id: string };
  profileId: string;
  permissions: AccessZonePermissionInput;
  notMemberMessage?: string;
}): Promise<ProfileUserWithNormalizedRoles> {
  const profileUser = await getProfileAccessUser({ user, profileId });

  if (!profileUser) {
    throw new UnauthorizedError(notMemberMessage ?? 'Not authorized');
  }

  if (!checkPermission(permissions, profileUser.roles)) {
    throw new UnauthorizedError('Not authorized');
  }

  return profileUser;
}
