import { permission } from 'access-zones';

import { assertProfileAccess } from './assertProfileAccess';

/**
 * Asserts that a user has admin permission on a profile.
 *
 * Thin wrapper around {@link assertProfileAccess} for the common
 * `{ profile: permission.ADMIN }` check.
 *
 * @param user - The user to check
 * @param profileId - The profile ID to check admin access for
 * @throws AccessControlException if the user doesn't have admin permission
 *   (including when the user is not a member of the profile)
 */
export async function assertProfileAdmin(
  user: { id: string },
  profileId: string,
): Promise<void> {
  await assertProfileAccess({ user, profileId }, { profile: permission.ADMIN });
}
