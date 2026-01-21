import { db } from '@op/db/client';
import type { ProfileUser } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * Fetches a profile user by ID and throws if not found.
 *
 * @param id - The profile user ID to look up
 * @param error - Custom error to throw if not found (defaults to NotFoundError)
 * @throws The provided error or NotFoundError if profile user is not found
 */
export async function assertProfileUser(
  id: string,
  error: Error = new NotFoundError('User not found', id),
): Promise<ProfileUser> {
  const profileUser = await db._query.profileUsers.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });

  if (!profileUser) {
    throw error;
  }

  return profileUser;
}
