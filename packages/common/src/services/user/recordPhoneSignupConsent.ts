import { db, eq } from '@op/db/client';
import { users } from '@op/db/schema';

export const policyAcceptanceSet = ({
  tos,
  privacy,
  now,
}: {
  tos: boolean;
  privacy: boolean;
  now: string;
}) => ({
  tos,
  privacy,
  ...(tos ? { tosAcceptedOn: now } : {}),
  ...(privacy ? { privacyAcceptedOn: now } : {}),
});

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
