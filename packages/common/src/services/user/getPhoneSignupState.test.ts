import { supabaseTestAdminClient } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { authUsers, profiles, users } from '@op/db/schema';
import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { parsePhoneNumber, toGoTruePhoneFormat } from '../notification/schemas';
import {
  PHONE_SIGNUP_REPLY_WINDOW_MINUTES,
  getPhoneSignupState,
} from './getPhoneSignupState';

/**
 * A number in Twilio's reserved test range, above the five the
 * `[auth.sms.test_otp]` block hands to the e2e suite, so no run collides.
 */
const testPhone = () =>
  parsePhoneNumber(`+1500555${String(randomInt(1000, 9999))}`);

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

const createPhoneUser = async ({
  phone,
  confirmed,
  codeSentAt,
  onTestFinished,
}: {
  phone: string;
  confirmed: boolean;
  codeSentAt?: Date;
  onTestFinished: (fn: () => Promise<void>) => void;
}): Promise<string> => {
  const { data, error } = await supabaseTestAdminClient.auth.admin.createUser({
    phone,
    phone_confirm: confirmed,
  });

  if (error || !data.user) {
    throw new Error(`Failed to create phone user: ${error?.message}`);
  }

  const authUserId = data.user.id;
  onTestFinished(async () => {
    const [user] = await db
      .select({ profileId: users.profileId })
      .from(users)
      .where(eq(users.authUserId, authUserId))
      .limit(1);
    await supabaseTestAdminClient.auth.admin.deleteUser(authUserId);
    if (user?.profileId) {
      await db.delete(profiles).where(eq(profiles.id, user.profileId));
    }
  });

  if (codeSentAt) {
    await db
      .update(authUsers)
      .set({ confirmationSentAt: codeSentAt })
      .where(eq(authUsers.phone, toGoTruePhoneFormat(phone)));
  }

  return authUserId;
};

describe.concurrent('getPhoneSignupState', () => {
  it('given a number no auth row holds, when looked up, then the number is free', async () => {
    const state = await getPhoneSignupState({ phone: testPhone() });

    expect(state).toEqual({ status: 'free' });
  });

  it('given an unconfirmed row that was never sent a code, when looked up, then the number is free', async ({
    onTestFinished,
  }) => {
    const phone = testPhone();
    await createPhoneUser({ phone, confirmed: false, onTestFinished });

    const state = await getPhoneSignupState({ phone });

    expect(state).toEqual({ status: 'free' });
  });

  it('given an unconfirmed row sent a code inside the reply window, when looked up, then an attempt is in progress', async ({
    onTestFinished,
  }) => {
    const phone = testPhone();
    const codeSentAt = minutesAgo(1);
    await createPhoneUser({
      phone,
      confirmed: false,
      codeSentAt,
      onTestFinished,
    });

    const state = await getPhoneSignupState({ phone });

    expect(state).toEqual({ status: 'attempt_in_progress', codeSentAt });
  });

  it('given an unconfirmed row sent a code before the reply window opened, when looked up, then the number is free again', async ({
    onTestFinished,
  }) => {
    const phone = testPhone();
    await createPhoneUser({
      phone,
      confirmed: false,
      codeSentAt: minutesAgo(PHONE_SIGNUP_REPLY_WINDOW_MINUTES + 1),
      onTestFinished,
    });

    const state = await getPhoneSignupState({ phone });

    expect(state).toEqual({ status: 'free' });
  });

  it('given a confirmed row, when looked up, then it is the account, whatever the last send time', async ({
    onTestFinished,
  }) => {
    const phone = testPhone();
    const authUserId = await createPhoneUser({
      phone,
      confirmed: true,
      codeSentAt: minutesAgo(1),
      onTestFinished,
    });

    const state = await getPhoneSignupState({ phone });

    expect(state).toEqual({
      status: 'confirmed',
      authUserId,
      profileId: expect.any(String),
    });
  });
});
