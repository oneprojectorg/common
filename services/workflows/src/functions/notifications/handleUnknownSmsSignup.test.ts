import { InngestTestEngine } from '@inngest/test';
import {
  type PhoneNumber,
  memorySmsProvider,
  parsePhoneNumber,
  PHONE_SIGNUP_REPLY_WINDOW_MINUTES,
  toGoTruePhoneFormat,
} from '@op/common';
import { TestPhoneAuthDataManager } from '@op/common/testing/helpers';
import { db, eq } from '@op/db/client';
import { authUsers, profiles, users } from '@op/db/schema';
import { Events } from '@op/events';
import { beforeEach, describe, expect, it } from 'vitest';

import { handleUnknownSmsSignup } from './handleUnknownSmsSignup';

/**
 * Numbers from `[auth.sms.test_otp]` in `supabase/supabase-test.toml`, the
 * instance this suite runs against (port 55321). GoTrue skips Twilio Verify
 * for them and accepts only the listed code, so the whole GoTrue round-trip
 * runs for real with no text sent. `+15005550006` is left to the demo
 * scripts. The e2e suite lists the same numbers on its own instance
 * (`supabase-e2e.toml`, port 56321), so the suites never race for a number.
 */
const TEST_NUMBERS = {
  '+15005550007': '234567',
  '+15005550008': '345678',
  '+15005550009': '456789',
  '+15005550010': '567890',
} as const;

type TestNumber = keyof typeof TEST_NUMBERS;

const inboundText = (from: PhoneNumber, code: string | null = null) => ({
  name: Events.smsInboundReceived.name,
  data: { from, messageSid: `SM-${from}-${code ?? 'text'}`, code },
});

const reply = (from: PhoneNumber, attempt: number, code: string | null) => ({
  id: `wait-for-confirmation-${attempt}`,
  handler: () => ({
    data: { from, messageSid: `SM-reply-${from}-${attempt}`, code },
  }),
});

const silence = (attempt: number) => ({
  id: `wait-for-confirmation-${attempt}`,
  handler: () => null,
});

const replyingWith = (from: PhoneNumber, code: string) => [
  reply(from, 1, code),
];

const noReply = [silence(1)];

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

const profileExists = async (profileId: string) => {
  const [row] = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  return row !== undefined;
};

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000);

/**
 * Reserves one test number for a test. The auth row the flow itself creates
 * is unknown up front, so cleanup looks it up by number when the test ends.
 */
const claimNumber = (
  number: TestNumber,
  testData: TestPhoneAuthDataManager,
) => {
  const phone = parsePhoneNumber(number);
  testData.cleanupByPhoneOnFinish(phone);
  return { phone, code: TEST_NUMBERS[number] };
};

beforeEach(() => {
  memorySmsProvider.reset();
});

describe('handleUnknownSmsSignup against the database', () => {
  it('given a stranger texts, when they reply with the code GoTrue sent, then the number is confirmed, the account exists, and they were texted twice', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone, code } = claimNumber('+15005550007', testData);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [inboundText(phone)],
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

  it('given an abandoned attempt whose code is older than the reply window, when the number texts again and nobody replies, then the consent text is sent and the unconfirmed account is discarded', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone } = claimNumber('+15005550008', testData);
    const authUserId = await testData.createUser({
      phone,
      confirmed: false,
      codeSentAt: minutesAgo(PHONE_SIGNUP_REPLY_WINDOW_MINUTES + 1),
    });
    const profileId = await readProfileId(authUserId);
    if (profileId === null) {
      throw new Error('The signup trigger created no profile for the test row');
    }
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [inboundText(phone)],
      steps: noReply,
    });

    expect(result).toEqual({
      message: 'timed out waiting for confirmation',
      discard: 'discarded',
    });
    expect(memorySmsProvider.sent.map((message) => message.to)).toEqual([
      phone,
    ]);
    expect(await readAuthUser(phone)).toBeNull();
    expect(await profileExists(profileId)).toBe(false);
  });

  it('given a code was texted moments ago and not yet confirmed, when the number texts again, then nothing is sent and no new code is requested', async ({
    task,
    onTestFinished,
  }) => {
    // Every inbound text is also a trigger. Without this branch the reply to
    // one attempt would start the next, one code per reply.
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone } = claimNumber('+15005550008', testData);
    await testData.createUser({
      phone,
      confirmed: false,
      codeSentAt: minutesAgo(1),
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [inboundText(phone)],
    });

    expect(result).toEqual({ message: 'signup attempt in progress, skipped' });
    expect(memorySmsProvider.sent).toEqual([]);
    expect((await readAuthUser(phone))?.phoneConfirmedAt).toBeNull();
  });

  it('given a confirmed account, when its number texts, then the flow skips it and sends nothing', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone } = claimNumber('+15005550009', testData);
    await testData.createUser({ phone, confirmed: true });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [inboundText(phone)],
    });

    expect(result).toEqual({ message: 'known number, skipped' });
    expect(memorySmsProvider.sent).toEqual([]);
  });

  it('given the sms-signup flag is off, when a stranger texts, then nothing is sent and no account is created', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone } = claimNumber('+15005550007', testData);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    // The project config pins the flag on; the override map is read per call,
    // so the test can flip it and restore it.
    const previous = process.env.FEATURE_FLAG_OVERRIDES;
    process.env.FEATURE_FLAG_OVERRIDES = 'sms-signup:false';
    try {
      const { result } = await t.execute({
        events: [inboundText(phone)],
      });

      expect(result).toEqual({ message: 'sms signup disabled' });
      expect(memorySmsProvider.sent).toEqual([]);
      expect(await readAuthUser(phone)).toBeNull();
    } finally {
      process.env.FEATURE_FLAG_OVERRIDES = previous;
    }
  });

  it('given a text from a number that is not E.164, when processed, then nothing is sent and no account is created', async () => {
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [
        {
          name: Events.smsInboundReceived.name,
          data: { from: 'not-a-phone', messageSid: 'SM-bad', code: null },
        },
      ],
    });

    expect(result).toEqual({ message: 'invalid phone number' });
    expect(memorySmsProvider.sent).toEqual([]);
  });

  it('given a stranger texts, when they reply with a wrong code and then go quiet, then no account remains and no welcome is sent', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone } = claimNumber('+15005550010', testData);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [inboundText(phone)],
      steps: [reply(phone, 1, '000000'), silence(2)],
    });

    expect(result).toEqual({
      message: 'timed out waiting for confirmation',
      discard: 'discarded',
    });
    expect(await readAuthUser(phone)).toBeNull();
    expect(memorySmsProvider.sent.map((message) => message.to)).toEqual([
      phone,
    ]);
  });

  it('given a stranger texts, when they reply with words first and the code second, then the account is created', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone, code } = claimNumber('+15005550009', testData);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [inboundText(phone)],
      steps: [reply(phone, 1, null), reply(phone, 2, code)],
    });

    const authUser = await readAuthUser(phone);
    expect(authUser?.phoneConfirmedAt).not.toBeNull();
    expect(result).toEqual({
      message: 'account created',
      authUserId: authUser?.id,
    });
    expect(memorySmsProvider.sent.map((message) => message.to)).toEqual([
      phone,
      phone,
    ]);
  });
});
