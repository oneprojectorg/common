import { parsePhoneNumber } from '@op/common';
import { db, eq } from '@op/db/client';
import { profiles, users } from '@op/db/schema';
import { createSBServiceClient } from '@op/supabase/server';
import { afterEach, describe, expect, it } from 'vitest';

import { mintPhoneSession } from './mintPhoneSession';

/**
 * Twilio reserves this range for testing, so no fixture names a real line.
 * The number never leaves the local Supabase instance in these tests.
 */
const PHONE = parsePhoneNumber('+15005550123');

/** GoTrue stores a phone number without the leading `+`. */
const STORED = PHONE.slice(1);

const findUser = async () => {
  const supabase = createSBServiceClient();
  const { data } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  return data.users.find((user) => user.phone === STORED);
};

/**
 * Removes the account and the profile the signup trigger built for it.
 *
 * Deleting the auth user cascades to `public.users`, but `users.profileId` is
 * `on delete set null`, so the profile outlives both. The suite's teardown
 * fails on a non-empty `profiles` table, and `deleteRejectedOAuthSignup` in
 * `routers/account/login.ts` deletes the pair in this same order.
 */
afterEach(async () => {
  const user = await findUser();
  if (!user) {
    return;
  }
  const [row] = await db
    .select({ profileId: users.profileId })
    .from(users)
    .where(eq(users.authUserId, user.id));

  await createSBServiceClient().auth.admin.deleteUser(user.id);

  if (row?.profileId) {
    await db.delete(profiles).where(eq(profiles.id, row.profileId));
  }
});

describe('mintPhoneSession', () => {
  it('creates a confirmed account and issues a session', async () => {
    const session = await mintPhoneSession({
      phone: PHONE,
      displayName: 'Phone Tester',
    });

    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();

    const user = await findUser();
    // Twilio already proved the person holds the number. Without the confirm
    // the account would carry an unconfirmed phone that nothing verifies.
    expect(user?.phone_confirmed_at).toBeTruthy();
  });

  it('stores the number without the leading plus', async () => {
    await mintPhoneSession({ phone: PHONE });

    // The lookup compares against this form. A change here silently makes
    // every returning caller look like a new account.
    expect((await findUser())?.phone).toBe(STORED);
  });

  it('passes the display name to the signup trigger', async () => {
    await mintPhoneSession({ phone: PHONE, displayName: 'Ada Lovelace' });

    // Without this the trigger names the account the literal `User`, because
    // it derives a name from the email local part and there is no email.
    const user = await findUser();
    expect(user?.user_metadata?.display_name).toBe('Ada Lovelace');
  });

  it('reuses the account on a second sign-in', async () => {
    await mintPhoneSession({ phone: PHONE, displayName: 'First' });
    const first = await findUser();

    const session = await mintPhoneSession({ phone: PHONE });

    // A second sign-in must not create a second account for one number.
    expect(session.accessToken).toBeTruthy();
    expect((await findUser())?.id).toBe(first?.id);
  });

  it('leaves an existing name alone on a later sign-in', async () => {
    await mintPhoneSession({ phone: PHONE, displayName: 'Chosen Name' });

    await mintPhoneSession({ phone: PHONE, displayName: 'Ignored' });

    // A person may have edited their name since signing up.
    expect((await findUser())?.user_metadata?.display_name).toBe('Chosen Name');
  });
});
