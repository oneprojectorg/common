import { db } from '@op/db/client';
import { type CommonUser } from '@op/db/schema';

import { NotFoundError } from '../../utils';

type AssertUserParams =
  | { id: string; authUserId?: never }
  | { id?: never; authUserId: string };

/**
 * Fetches a user and throws if not found.
 *
 * @throws NotFoundError if user is not found
 */
export async function assertUser(params: AssertUserParams): Promise<CommonUser> {
  const { id, authUserId } = params;

  const user = await db.query.users.findFirst({
    where: (table, { eq }) =>
      id ? eq(table.id, id) : eq(table.authUserId, authUserId!),
  });

  if (!user) {
    throw new NotFoundError('User', id ?? authUserId);
  }

  return user;
}
