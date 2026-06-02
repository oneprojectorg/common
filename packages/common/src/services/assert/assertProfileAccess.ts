import { type AccessZonePermissionInput, assertAccess } from 'access-zones';

import { getProfileAccessUser } from '../access';

/**
 * Fetches the user's roles on a profile and asserts the given permissions.
 *
 * Throws (via access-zones `assertAccess`) if the user lacks them — including
 * when the user has no role on the profile, in which case the roles are empty.
 *
 * Returns the resolved profile-access user so callers that also need the
 * profileUser (its roles, profile, etc.) can reuse it instead of re-fetching.
 * Callers that only need the gate can ignore the return value.
 *
 * @param user - The user to check
 * @param profileId - The profile to check access against
 * @param permissions - The required permissions (single object or array of objects)
 * @returns The profile-access user (or `undefined` — though a missing user
 *   means empty roles, which fails the assertion for any real permission)
 * @throws AccessControlException if the user's roles don't satisfy the permissions
 */
export async function assertProfileAccess(
  { user, profileId }: { user: { id: string }; profileId: string },
  permissions: AccessZonePermissionInput,
) {
  const profileUser = await getProfileAccessUser({ user, profileId });

  assertAccess(permissions, profileUser?.roles ?? []);

  return profileUser;
}
