import { aliasedTable, and, db, eq, isNotNull } from '@op/db/client';
import { authUsers, users } from '@op/db/schema';

import { toGoTruePhoneFormat } from '../notification/schemas';
import type { PhoneNumber } from '../notification/types';

/** The account a confirmed phone number belongs to. */
export interface ConfirmedPhoneAccount {
  authUserId: string;
  /** Null until the signup trigger has linked a profile. */
  profileId: string | null;
}

/**
 * Finds the account whose confirmed phone number is `phone`.
 *
 * GoTrue creates an `auth.users` row the moment `signInWithOtp` is called,
 * before the holder has proven anything, and stores the number without the
 * leading `+`. A row alone therefore does not mean an account exists: only a
 * row with `phone_confirmed_at` set does. An unconfirmed row reads as "no
 * account", so a holder who abandoned one attempt can start another.
 *
 * @param input.phone - The number to look up, already validated.
 * @returns The confirmed account, or null when the number holds no confirmed
 *   account.
 */
export const findConfirmedPhoneAccount = async ({
  phone,
}: {
  phone: PhoneNumber;
}): Promise<ConfirmedPhoneAccount | null> => {
  const authUser = aliasedTable(authUsers, 'auth_user');

  const [row] = await db
    .select({ authUserId: authUser.id, profileId: users.profileId })
    .from(authUser)
    .leftJoin(users, eq(users.authUserId, authUser.id))
    .where(
      and(
        eq(authUser.phone, toGoTruePhoneFormat(phone)),
        isNotNull(authUser.phoneConfirmedAt),
      ),
    )
    .limit(1);

  return row ?? null;
};
