import { db, eq } from '@op/db/client';
import { authUsers, profiles, users } from '@op/db/schema';
import { logger } from '@op/logging';
import { createSBServiceClient } from '@op/supabase/server';

import { CommonError } from '../../utils/error';
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
    .select({
      id: authUsers.id,
      phoneConfirmedAt: authUsers.phoneConfirmedAt,
      confirmationSentAt: authUsers.confirmationSentAt,
    })
    .from(authUsers)
    .where(eq(authUsers.phone, toGoTruePhoneFormat(phone)))
    .limit(1);

  if (!authUser) {
    return { status: 'kept', reason: 'no_row' };
  }

  if (authUser.phoneConfirmedAt) {
    return { status: 'kept', reason: 'confirmed' };
  }

  if (
    authUser.confirmationSentAt &&
    authUser.confirmationSentAt > codeSentNoLaterThan
  ) {
    return { status: 'kept', reason: 'newer_attempt' };
  }

  const [user] = await db
    .select({ profileId: users.profileId })
    .from(users)
    .where(eq(users.authUserId, authUser.id))
    .limit(1);

  const { error } = await createSBServiceClient().auth.admin.deleteUser(
    authUser.id,
  );

  if (error) {
    throw new CommonError(
      `GoTrue refused to delete an abandoned phone signup: ${error.message}`,
    );
  }

  if (user?.profileId) {
    await db.delete(profiles).where(eq(profiles.id, user.profileId));
  }

  logger.info('Discarded an abandoned phone signup', {
    authUserId: authUser.id,
  });

  return { status: 'discarded', authUserId: authUser.id };
};
