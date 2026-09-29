import { supabaseTestAdminClient } from '@op/common/testing';
import { db, eq } from '@op/db/client';
import { profiles, users } from '@op/db/schema';
import { randomInt } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { parsePhoneNumber } from '../notification/schemas';
import { findConfirmedPhoneAccount } from './findConfirmedPhoneAccount';

/**
 * A number in Twilio's reserved test range, above the five the
 * `[auth.sms.test_otp]` block hands to the e2e suite, so no run collides.
 */
const testPhone = () =>
  parsePhoneNumber(`+1500555${String(randomInt(1000, 9999))}`);

const createPhoneUser = async ({
  phone,
  confirmed,
  onTestFinished,
}: {
  phone: string;
  confirmed: boolean;
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

  return authUserId;
};

describe.concurrent('findConfirmedPhoneAccount', () => {
  it('given a number with an unconfirmed auth row, when looked up, then it is not an account', async ({
    onTestFinished,
  }) => {
    const phone = testPhone();
    await createPhoneUser({ phone, confirmed: false, onTestFinished });

    const account = await findConfirmedPhoneAccount({ phone });

    expect(account).toBeNull();
  });

  it('given a number with a confirmed auth row, when looked up, then it returns that account', async ({
    onTestFinished,
  }) => {
    const phone = testPhone();
    const authUserId = await createPhoneUser({
      phone,
      confirmed: true,
      onTestFinished,
    });

    const account = await findConfirmedPhoneAccount({ phone });

    expect(account).toEqual({ authUserId, profileId: expect.any(String) });
  });

  it('given a number no auth row holds, when looked up, then it is not an account', async () => {
    const account = await findConfirmedPhoneAccount({ phone: testPhone() });

    expect(account).toBeNull();
  });
});
