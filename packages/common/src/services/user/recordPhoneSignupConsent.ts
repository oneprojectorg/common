import { db, eq } from '@op/db/client';
import { users } from '@op/db/schema';

export const recordPhoneSignupConsent = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<void> => {
  const now = new Date().toISOString();

  await db
    .update(users)
    .set({
      tos: true,
      privacy: true,
      tosAcceptedOn: now,
      privacyAcceptedOn: now,
    })
    .where(eq(users.authUserId, authUserId));
};
