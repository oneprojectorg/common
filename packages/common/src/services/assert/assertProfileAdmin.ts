import { permission } from 'access-zones';

import type { AccessUser, ProfileUserWithNormalizedRoles } from '../access';
import { assertProfileAccess } from './assertProfileAccess';

/**
 * Asserts that a user has admin permission on a profile, returning the
 * resolved profile-access user so callers can reuse it.
 *
 * Thin wrapper around {@link assertProfileAccess} for the common
 * `{ profile: permission.ADMIN }` check.
 *
 * @throws UnauthorizedError if the user doesn't have admin permission
 *   (including when the user is not a member of the profile)
 */
export async function assertProfileAdmin({
  user,
  profileId,
}: {
  user?: AccessUser;
  profileId: string;
}): Promise<ProfileUserWithNormalizedRoles> {
  return assertProfileAccess({
    user,
    profileId,
    permissions: { profile: permission.ADMIN },
  });
}
