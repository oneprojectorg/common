import { type DbClient, db as defaultDb } from '@op/db/client';
import type { ProfileUser } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * Fetches a profile user by ID and throws if not found.
 */
export async function assertProfileUser(
  id: string,
  error: Error = new NotFoundError('User not found', id),
  db: DbClient = defaultDb,
): Promise<ProfileUser> {
  const profileUser = await db.query.profileUsers.findFirst({
    where: { id },
  });

  if (!profileUser) {
    throw error;
  }

  return profileUser;
}
