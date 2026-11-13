import { db, eq } from '@op/db/client';
import { authUsers, users } from '@op/db/schema';

import { type PhoneNumber, toGoTruePhoneFormat } from '../notification/schemas';

/**
 * How long a texted code stays answerable. The inbound signup flow waits this
 * long for a reply, so a text that arrives inside it belongs to that attempt.
 */
export const PHONE_SIGNUP_REPLY_WINDOW_MINUTES = 10;

/**
 * Where a phone number stands with GoTrue.
 *
 * `confirmed`: the holder proved the number, and it is an account.
 * `attempt_in_progress`: GoTrue sent a code inside the reply window and the
 *   holder has not confirmed. A text from the number now is a reply to that
 *   attempt, not a request to start another.
 * `free`: no row, or an unconfirmed row whose code is old or never sent. A
 *   text from the number starts a new attempt.
 */
export type PhoneSignupState =
  | { status: 'confirmed'; authUserId: string; profileId: string | null }
  | { status: 'attempt_in_progress'; codeSentAt: Date }
  | { status: 'free' };

/**
 * Reads the signup state of `phone` from the `auth.users` row GoTrue keeps.
 *
 * GoTrue creates the row the moment `signInWithOtp` is called and stores the
 * number without the leading `+`, so a row alone does not mean an account.
 * Only `phone_confirmed_at` does. GoTrue also stamps `confirmation_sent_at`
 * on every code it sends, which is what tells a reply apart from a fresh
 * start: without that, every text from a stranger who has not confirmed would
 * start another code send, one per reply.
 *
 * The profile is read in a second query rather than a join. `auth.users` and
 * `public.users` share the name `users`, and Drizzle keys join nullability by
 * table name, so a join between them types as `never` even when Postgres
 * accepts it.
 *
 * @param input.phone - The number to look up, already validated.
 * @param input.now - The moment to measure the reply window from. Defaults
 *   to the current time.
 */
export const getPhoneSignupState = async ({
  phone,
  now = new Date(),
}: {
  phone: PhoneNumber;
  now?: Date;
}): Promise<PhoneSignupState> => {
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
    return { status: 'free' };
  }

  if (authUser.phoneConfirmedAt) {
    const [user] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, authUser.id))
      .limit(1);

    return {
      status: 'confirmed',
      authUserId: authUser.id,
      profileId: user?.profileId ?? null,
    };
  }

  const windowOpenedAt = new Date(
    now.getTime() - PHONE_SIGNUP_REPLY_WINDOW_MINUTES * 60_000,
  );

  if (
    authUser.confirmationSentAt &&
    authUser.confirmationSentAt > windowOpenedAt
  ) {
    return {
      status: 'attempt_in_progress',
      codeSentAt: authUser.confirmationSentAt,
    };
  }

  return { status: 'free' };
};
