import { InngestTestEngine } from '@inngest/test';
import {
  type PhoneNumber,
  memorySmsProvider,
  parsePhoneNumber,
  toGoTruePhoneFormat,
} from '@op/common';
import { db, eq } from '@op/db/client';
import { authUsers, profiles, users } from '@op/db/schema';
import { Events } from '@op/events';
import { createSBServiceClient } from '@op/supabase/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { handleUnknownSmsSignup } from './handleUnknownSmsSignup';

/**
 * Numbers from `[auth.sms.test_otp]` in `supabase/config.toml`. GoTrue skips
 * Twilio Verify for them and accepts only the listed code, so the whole
 * GoTrue round-trip runs for real with no text sent. `+15005550006` is left to
 * the demo scripts; the e2e suite claims the same four, so this file must not
 * run at the same time as `pnpm e2e`.
 */
const TEST_NUMBERS = {
  '+15005550007': '234567',
  '+15005550008': '345678',
  '+15005550009': '456789',
  '+15005550010': '567890',
} as const;

type TestNumber = keyof typeof TEST_NUMBERS;

const supabase = createSBServiceClient();

const inboundText = (from: PhoneNumber, body: string) => ({
  name: Events.smsInboundReceived.name,
  data: { from, body, messageSid: `SM-${from}-${body}` },
});

const replyingWith = (from: PhoneNumber, body: string) => [
  {
    id: 'wait-for-confirmation',
    handler: () => ({ data: { from, body, messageSid: `SM-reply-${from}` } }),
  },
];

const noReply = [{ id: 'wait-for-confirmation', handler: () => null }];

const readAuthUser = async (phone: PhoneNumber) => {
  const [row] = await db
    .select({ id: authUsers.id, phoneConfirmedAt: authUsers.phoneConfirmedAt })
    .from(authUsers)
    .where(eq(authUsers.phone, toGoTruePhoneFormat(phone)))
    .limit(1);
  return row ?? null;
};

const readProfileId = async (authUserId: string) => {
  const [row] = await db
    .select({ profileId: users.profileId })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);
  return row?.profileId ?? null;
};

/** Removes the GoTrue row and the profile the signup trigger created for it. */
const removePhoneAccount = async (phone: PhoneNumber) => {
  const authUser = await readAuthUser(phone);
  if (!authUser) {
    return;
  }
  const profileId = await readProfileId(authUser.id);
  await supabase.auth.admin.deleteUser(authUser.id);
  if (profileId) {
    await db.delete(profiles).where(eq(profiles.id, profileId));
  }
};

const claimNumber = (
  number: TestNumber,
  onTestFinished: (fn: () => Promise<void>) => void,
) => {
  const phone = parsePhoneNumber(number);
  onTestFinished(() => removePhoneAccount(phone));
  return { phone, code: TEST_NUMBERS[number] };
};

const seedPhoneUser = async ({
  phone,
  confirmed,
}: {
  phone: PhoneNumber;
  confirmed: boolean;
}) => {
  const { error } = await supabase.auth.admin.createUser({
    phone,
    phone_confirm: confirmed,
  });
  if (error) {
    throw new Error(`Failed to seed phone user: ${error.message}`);
  }
};

beforeEach(() => {
  memorySmsProvider.reset();
});

describe('handleUnknownSmsSignup against the database', () => {
  it('given a stranger texts, when they reply with the code GoTrue sent, then the number is confirmed, the account exists, and they were texted twice', async ({
    onTestFinished,
  }) => {
    const { phone, code } = claimNumber('+15005550007', onTestFinished);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [inboundText(phone, 'hello')],
      steps: replyingWith(phone, code),
    });

    const authUser = await readAuthUser(phone);
    expect(authUser?.phoneConfirmedAt).not.toBeNull();
    expect(result).toEqual({
      message: 'account created',
      authUserId: authUser?.id,
    });
    expect(await readProfileId(authUser!.id)).toEqual(expect.any(String));
    expect(memorySmsProvider.sent.map((message) => message.to)).toEqual([
      phone,
      phone,
    ]);
  });

  it('given an earlier attempt left an unconfirmed row, when the number texts again, then a new code is requested and the consent text is sent', async ({
    onTestFinished,
  }) => {
    const { phone } = claimNumber('+15005550008', onTestFinished);
    await seedPhoneUser({ phone, confirmed: false });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [inboundText(phone, 'hello again')],
      steps: noReply,
    });

    expect(result).toEqual({ message: 'timed out waiting for confirmation' });
    expect(memorySmsProvider.sent.map((message) => message.to)).toEqual([
      phone,
    ]);
    expect((await readAuthUser(phone))?.phoneConfirmedAt).toBeNull();
  });

  it('given a confirmed account, when its number texts, then the flow skips it and sends nothing', async ({
    onTestFinished,
  }) => {
    const { phone } = claimNumber('+15005550009', onTestFinished);
    await seedPhoneUser({ phone, confirmed: true });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [inboundText(phone, 'hello')],
    });

    expect(result).toEqual({ message: 'known number, skipped' });
    expect(memorySmsProvider.sent).toEqual([]);
  });

  it('given a stranger texts, when they reply with a wrong code, then the number stays unconfirmed and no welcome is sent', async ({
    onTestFinished,
  }) => {
    const { phone } = claimNumber('+15005550010', onTestFinished);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [inboundText(phone, 'hello')],
      steps: replyingWith(phone, '000000'),
    });

    expect(result).toMatchObject({ message: 'code rejected' });
    expect((await readAuthUser(phone))?.phoneConfirmedAt).toBeNull();
    expect(memorySmsProvider.sent.map((message) => message.to)).toEqual([
      phone,
    ]);
  });
});
