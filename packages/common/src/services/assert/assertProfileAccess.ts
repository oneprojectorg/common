import {
  AccessControlException,
  type AccessZonePermissionInput,
  assertAccess,
} from 'access-zones';

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
 * @throws AccessControlException if the user is not a member of the profile or
 *   their roles don't satisfy the permissions — every denial throws the same
 *   exception type (only the message differs when `notMemberMessage` is given).
 */
export async function assertProfileAccess(
  { user, profileId }: { user: { id: string }; profileId: string },
  permissions: AccessZonePermissionInput,
  notMemberMessage?: string,
): Promise<ProfileUserWithNormalizedRoles> {
  const profileUser = await getProfileAccessUser({ user, profileId });

  if (!profileUser) {
    throw new AccessControlException({
      message: notMemberMessage ?? 'Not authorized',
      status: 'unauthorized',
    });
  }

  assertAccess(permissions, profileUser.roles);

  return profileUser;
}
