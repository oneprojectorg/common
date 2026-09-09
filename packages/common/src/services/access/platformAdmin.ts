import { db, eq } from '@op/db/client';
import { users } from '@op/db/schema';
import { z } from 'zod';

import { ValidationError } from '../../utils/error';

const authUserIdSchema = z.uuid('Invalid authentication user ID format');

/**
 * Whether the user holds the platform-wide admin grant. Read straight from the
 * row: nothing in the app writes the flag, so there is nothing to invalidate.
 */
export const isPlatformAdmin = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<boolean> => {
  const parsed = authUserIdSchema.safeParse(authUserId);

  if (!parsed.success) {
    throw new ValidationError('Invalid authentication user ID format');
  }

  const [row] = await db
    .select({ isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.authUserId, parsed.data.toLowerCase()))
    .limit(1);

  // No row means an authenticated caller with no grant, which is the same answer.
  return row?.isPlatformAdmin ?? false;
};
