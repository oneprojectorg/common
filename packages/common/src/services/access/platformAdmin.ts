import { db, eq } from '@op/db/client';
import { users } from '@op/db/schema';

/** Whether the user holds the platform-wide admin grant (ADR 0005). */
export const isPlatformAdmin = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<boolean> => {
  const [row] = await db
    .select({ isPlatformAdmin: users.isPlatformAdmin })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);

  return row?.isPlatformAdmin ?? false;
};
