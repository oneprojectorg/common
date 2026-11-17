import { db, eq } from '@op/db/client';
import { users } from '@op/db/schema';

import { policyAcceptanceSet } from './policyAcceptance';

export const recordPhoneSignupConsent = async ({
  authUserId,
}: {
  authUserId: string;
}): Promise<string | null> => {
  const now = new Date().toISOString();

  const [row] = await db
    .update(users)
    .set(policyAcceptanceSet({ tos: true, privacy: true, now }))
    .where(eq(users.authUserId, authUserId))
    .returning({ profileId: users.profileId });

  return row?.profileId ?? null;
};
