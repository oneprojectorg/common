import { db } from '@op/db/client';
import type { CommonUser } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * Fetches a user by ID and throws if not found.
 *
 * @param id - The user ID to look up
 * @param error - Custom error to throw if not found (defaults to NotFoundError)
 * @throws The provided error or NotFoundError if user is not found
 */
export async function assertUser(
  id: string,
  error: Error = new NotFoundError('User', id),
): Promise<CommonUser> {
  const user = await db._query.users.findFirst({
    where: (table, { eq }) => eq(table.id, id),
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
 * @throws The provided error or NotFoundError if user is not found
 */
export async function assertUserByAuthId(
  authUserId: string,
  error: Error = new NotFoundError('User', authUserId),
): Promise<CommonUser> {
  const user = await db._query.users.findFirst({
    where: (table, { eq }) => eq(table.authUserId, authUserId),
  });

  if (!user) {
    throw error;
  }

  return user;
}
