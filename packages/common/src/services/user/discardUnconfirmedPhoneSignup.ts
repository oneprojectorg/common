import { and, db, eq, isNull, lte, or } from '@op/db/client';
import { authUsers, profiles, users } from '@op/db/schema';
import { logger } from '@op/logging';

import { type PhoneNumber, toGoTruePhoneFormat } from '../notification/schemas';

export type PhoneSignupDiscard =
  | { status: 'discarded'; authUserId: string }
  | { status: 'kept'; reason: 'no_row' | 'confirmed' | 'newer_attempt' };

export const discardUnconfirmedPhoneSignup = async ({
  phone,
  codeSentNoLaterThan,
}: {
  phone: PhoneNumber;
  codeSentNoLaterThan: Date;
}): Promise<PhoneSignupDiscard> => {
  const [authUser] = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.phone, toGoTruePhoneFormat(phone)))
    .limit(1);

  if (!authUser) {
    return { status: 'kept', reason: 'no_row' };
  }

  const [user] = await db
    .select({ profileId: users.profileId })
    .from(users)
    .where(eq(users.authUserId, authUser.id))
    .limit(1);

  const [deleted] = await db
    .delete(authUsers)
    .where(
      and(
        eq(authUsers.id, authUser.id),
        isNull(authUsers.phoneConfirmedAt),
        or(
          isNull(authUsers.confirmationSentAt),
          lte(authUsers.confirmationSentAt, codeSentNoLaterThan),
        ),
      ),
    )
    .returning({ id: authUsers.id });

  if (!deleted) {
    const [kept] = await db
      .select({ phoneConfirmedAt: authUsers.phoneConfirmedAt })
      .from(authUsers)
      .where(eq(authUsers.id, authUser.id))
      .limit(1);

    if (!kept) {
      return { status: 'kept', reason: 'no_row' };
    }

    return {
      status: 'kept',
      reason: kept.phoneConfirmedAt ? 'confirmed' : 'newer_attempt',
    };
  }

  if (user?.profileId) {
    await db.delete(profiles).where(eq(profiles.id, user.profileId));
  }

  logger.info('Discarded an abandoned phone signup', {
    authUserId: deleted.id,
  });

  return { status: 'discarded', authUserId: deleted.id };
};
