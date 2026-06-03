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
 * Fetches the user's roles on a profile and asserts the given permissions.
 *
 * Throws an `AccessControlException` if the user is not a member of the profile
 * or their roles don't satisfy the permissions — every denial surfaces as the
 * same exception, with no member/non-member distinction.
 *
 * Returns the resolved profile-access user so callers that also need the
 * profileUser (its roles, profile, etc.) can reuse it instead of re-fetching.
 * Callers that only need the gate can ignore the return value.
 *
 * @param user - The user to check
 * @param profileId - The profile to check access against
 * @param permissions - The required permissions (single object or array of objects)
 * @param notMemberMessage - Optional message for the `AccessControlException`
 *   thrown when the user has no role on the profile. Defaults to the standard
 *   access-zones denial message.
 * @returns The profile-access user (always present — a missing membership throws)
 * @throws AccessControlException if the user is not a member of the profile or
 *   their roles don't satisfy the permissions
 */
export async function assertProfileAccess(
  { user, profileId }: { user: { id: string }; profileId: string },
  permissions: AccessZonePermissionInput,
  notMemberMessage?: string,
): Promise<ProfileUserWithNormalizedRoles> {
  const profileUser = await getProfileAccessUser({ user, profileId });

  if (!profileUser) {
    throw new AccessControlException({
      message: notMemberMessage ?? 'Not authenticated',
      status: 'unauthorized',
    });
  }

  assertAccess(permissions, profileUser.roles);

  return profileUser;
}
