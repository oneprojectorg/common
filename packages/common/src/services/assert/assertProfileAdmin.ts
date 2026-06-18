import { type NormalizedRole, permission } from 'access-zones';

import type { AccessUser } from '../access';
import { assertProfileAccess } from './assertProfileAccess';

/**
 * Asserts that a user has admin permission on a profile, returning the
 * resolved roles so callers can reuse them.
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
}): Promise<{ roles: NormalizedRole[] }> {
  return assertProfileAccess({
    user,
    profileId,
    permissions: { profile: permission.ADMIN },
  });
}
