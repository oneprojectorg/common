import { db } from '@op/db/client';
import type { ProfileUser } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * Fetches a profile user by ID and throws if not found.
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
