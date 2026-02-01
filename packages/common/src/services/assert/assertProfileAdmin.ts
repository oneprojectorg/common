import { assertAccess, permission } from 'access-zones';

import { UnauthorizedError } from '../../utils';
import { getProfileAccessUser } from '../access';

/**
 * Asserts that a user has admin permission on a profile.
 *
 * @param user - The user to check
 * @param profileId - The profile ID to check admin access for
 * @throws UnauthorizedError if user is not a member of the profile
 * @throws AccessError if user doesn't have admin permission
 */
export async function assertProfileAdmin(
  user: { id: string },
  profileId: string,
): Promise<void> {
  const profileUser = await getProfileAccessUser({ user, profileId });

  if (!profileUser) {
    throw new UnauthorizedError('You are not a member of this profile');
  }

  assertAccess({ profile: permission.ADMIN }, profileUser.roles || []);
}
