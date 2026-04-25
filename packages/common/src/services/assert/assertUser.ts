import { type DbClient, db as defaultDb } from '@op/db/client';
import type { CommonUser } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * Fetches a user by ID and throws if not found.
 *
 * @param id - The user ID to look up
 * @param error - Custom error to throw if not found (defaults to NotFoundError)
 * @param db - Optional database client or transaction to use
 * @throws The provided error or NotFoundError if user is not found
 */
export async function assertUser(
  id: string,
  error: Error = new NotFoundError('User', id),
  db: DbClient = defaultDb,
): Promise<CommonUser> {
  const user = await db.query.users.findFirst({
    where: { id },
  });

  if (!user) {
    throw error;
  }

  return user;
}

/**
 * Fetches a user by auth user ID and throws if not found.
 *
 * @param authUserId - The auth user ID to look up
 * @param error - Custom error to throw if not found (defaults to NotFoundError)
 * @param db - Optional database client or transaction to use
 * @throws The provided error or NotFoundError if user is not found
 */
export async function assertUserByAuthId(
  authUserId: string,
  error: Error = new NotFoundError('User', authUserId),
  db: DbClient = defaultDb,
): Promise<CommonUser> {
  const user = await db.query.users.findFirst({
    where: { authUserId },
  });

  if (!user) {
    throw error;
  }

  return user;
}
