import { db } from '@op/db/client';
import type { CommonUser } from '@op/db/schema';

import { NotFoundError } from '../../utils';

/**
 * Fetches a user by ID and throws if not found.
 *
 * @throws NotFoundError if user is not found
 */
export async function assertUser(id: string): Promise<CommonUser> {
  const user = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.id, id),
  });

  if (!user) {
    throw new NotFoundError('User', id);
  }

  return user;
}

/**
 * Fetches a user by auth user ID and throws if not found.
 *
 * @throws NotFoundError if user is not found
 */
export async function assertUserByAuthId(
  authUserId: string,
): Promise<CommonUser> {
  const user = await db.query.users.findFirst({
    where: (table, { eq }) => eq(table.authUserId, authUserId),
  });

  if (!user) {
    throw new NotFoundError('User', authUserId);
  }

  return user;
}
