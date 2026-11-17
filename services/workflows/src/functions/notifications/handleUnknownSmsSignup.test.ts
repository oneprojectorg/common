import { InngestTestEngine } from '@inngest/test';
import {
  type PhoneNumber,
  parsePhoneNumber,
  PHONE_SIGNUP_REPLY_WINDOW_MINUTES,
  requestPhoneSignupCode,
  toGoTruePhoneFormat,
} from '@op/common';
import { TestDecisionsDataManager } from '@op/common/testing';
import { createDecisionPhoneNumber } from '@op/common/testing/data';
import { TestPhoneAuthDataManager } from '@op/common/testing/helpers';
import { db, eq } from '@op/db/client';
import { authUsers, profiles, users } from '@op/db/schema';
import { beforeEach, describe, expect, it } from 'vitest';

import { recordedSms, resetRecordedSms } from '../../../testing/mocks/sms';
import { smsInboundEvent } from '../../../testing/smsInboundEvent';
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

const reply = (from: PhoneNumber, attempt: number, code: string | null) => ({
  id: `wait-for-confirmation-${attempt}`,
  handler: () => ({
    data: smsInboundEvent({
      from,
      code,
      messageSid: `SM-reply-${from}-${attempt}`,
    }).data,
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

const LINE = '+16145550140';

const readAuthUser = async (phone: PhoneNumber) => {
  const [row] = await db
    .select({ id: authUsers.id, phoneConfirmedAt: authUsers.phoneConfirmedAt })
    .from(authUsers)
    .where(eq(authUsers.phone, toGoTruePhoneFormat(phone)))
    .limit(1);
  return row ?? null;
};

const readUserRow = async (authUserId: string) => {
  const [row] = await db
    .select({
      profileId: users.profileId,
      tos: users.tos,
      privacy: users.privacy,
      tosAcceptedOn: users.tosAcceptedOn,
      privacyAcceptedOn: users.privacyAcceptedOn,
    })
    .from(users)
    .where(eq(users.authUserId, authUserId))
    .limit(1);
  return row ?? null;
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

const createBoundLine = async (
  taskId: string,
  onTestFinished: ConstructorParameters<typeof TestDecisionsDataManager>[1],
) => {
  const decisions = new TestDecisionsDataManager(taskId, onTestFinished);
  const line = parsePhoneNumber(LINE);
  const setup = await decisions.createDecisionSetup({ instanceCount: 1 });
  await createDecisionPhoneNumber({
    processInstanceId: setup.instance.instance.id,
    phoneNumber: line,
  });
  return line;
};

beforeEach(() => {
  resetRecordedSms();
});

describe('handleUnknownSmsSignup against the database', () => {
  it('given a stranger texts off any decision line, then they are texted help and no account is created', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone } = claimNumber('+15005550008', testData);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: phone })],
    });

    expect(result).toEqual({ message: 'help sent' });
    expect(recordedSms).toEqual([
      expect.objectContaining({
        to: phone,
        body: expect.stringContaining('STOP'),
      }),
    ]);
    expect(recordedSms[0]?.body).not.toContain('JOIN');
    expect(await readAuthUser(phone)).toBeNull();
  });

  it('given a stranger texts a decision line, when they reply with the code GoTrue sent, then the account exists with consent stamped, and they were texted twice', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone, code } = claimNumber('+15005550007', testData);
    const line = await createBoundLine(task.id, onTestFinished);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: phone, to: line })],
      steps: replyingWith(phone, code),
    });

    const authUser = await readAuthUser(phone);
    expect(authUser?.phoneConfirmedAt).not.toBeNull();
    expect(result).toEqual({
      message: 'account created',
      authUserId: authUser?.id,
      replayed: false,
    });
    const userRow = await readUserRow(authUser!.id);
    expect(userRow).toMatchObject({
      profileId: expect.any(String),
      tos: true,
      privacy: true,
      tosAcceptedOn: expect.any(String),
      privacyAcceptedOn: expect.any(String),
    });
    expect(recordedSms.map((message) => message.to)).toEqual([phone, phone]);
    expect(recordedSms.at(-1)?.body).toBe(
      "You're in! Welcome to Common. Text VOTE to register.",
    );
  });

  it('given a stranger texts VOTE to a bound line, when they reply with the code, then both texts come from that line and the command replays', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone, code } = claimNumber('+15005550010', testData);
    const line = await createBoundLine(task.id, onTestFinished);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({
          from: phone,
          to: line,
          keyword: 'vote',
          body: 'VOTE',
        }),
      ],
      steps: replyingWith(phone, code),
    });

    expect(result).toMatchObject({
      message: 'account created',
      replayed: true,
    });
    expect(recordedSms.map((message) => [message.to, message.from])).toEqual([
      [phone, line],
      [phone, line],
    ]);
    expect(recordedSms.at(-1)?.body).toBe("You're in! Welcome to Common.");
  });

  it('given an abandoned attempt whose code is older than the reply window, when the number texts a line again and nobody replies, then the consent text is sent and the unconfirmed account is discarded', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone } = claimNumber('+15005550008', testData);
    const line = await createBoundLine(task.id, onTestFinished);
    const authUserId = await testData.createUser({
      phone,
      confirmed: false,
      codeSentAt: minutesAgo(PHONE_SIGNUP_REPLY_WINDOW_MINUTES + 1),
    });
    const profileId = (await readUserRow(authUserId))?.profileId;
    if (!profileId) {
      throw new Error('The signup trigger created no profile for the test row');
    }
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: phone, to: line })],
      steps: noReply,
    });

    expect(result).toEqual({
      message: 'timed out waiting for confirmation',
      discard: 'discarded',
    });
    expect(recordedSms.map((message) => message.to)).toEqual([phone]);
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
      events: [smsInboundEvent({ from: phone })],
    });

    expect(result).toEqual({ message: 'signup attempt in progress, skipped' });
    expect(recordedSms).toEqual([]);
    expect((await readAuthUser(phone))?.phoneConfirmedAt).toBeNull();
  });

  it('given a signup parked on the consent reply under the pre-release step ids, when the code arrives, then the account is still created', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone, code } = claimNumber('+15005550009', testData);
    const codeRequest = await requestPhoneSignupCode({ phone });
    expect(codeRequest).toEqual({ status: 'sent' });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: phone })],
      steps: [
        { id: 'check-feature-flag', handler: () => true },
        { id: 'check-known-number', handler: () => ({ status: 'free' }) },
        { id: 'resolve-line', handler: () => null },
        { id: 'request-signup-code', handler: () => ({ status: 'sent' }) },
        { id: 'read-code-sent-at', handler: () => Date.now() - 60_000 },
        {
          id: 'send-consent-request',
          handler: () => ({
            status: 'accepted',
            providerMessageId: 'pre-deploy',
          }),
        },
        {
          id: 'start-reply-window',
          handler: () =>
            Date.now() + (PHONE_SIGNUP_REPLY_WINDOW_MINUTES - 1) * 60_000,
        },
        reply(phone, 1, code),
      ],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: expect.any(String),
      replayed: false,
    });
    const authUser = await readAuthUser(phone);
    expect(authUser?.phoneConfirmedAt).not.toBeNull();
    expect(result).toMatchObject({ authUserId: authUser?.id });
    expect(recordedSms.map((message) => message.to)).toEqual([phone]);
    expect(recordedSms.at(-1)?.body).toBe(
      "You're in! Welcome to Common. Text VOTE to register.",
    );
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
      events: [smsInboundEvent({ from: phone })],
    });

    expect(result).toEqual({ message: 'known number, skipped' });
    expect(recordedSms).toEqual([]);
  });

  it('given the sms-signup flag is off, when a stranger texts, then nothing is sent and no account is created', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone } = claimNumber('+15005550007', testData);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    // The project config forces every flag on through NEXT_PUBLIC_E2E, read
    // per call, so the test can lift it and restore it.
    const previous = process.env.NEXT_PUBLIC_E2E;
    delete process.env.NEXT_PUBLIC_E2E;
    try {
      const { result } = await t.execute({
        events: [smsInboundEvent({ from: phone })],
      });

      expect(result).toEqual({ message: 'sms signup disabled' });
      expect(recordedSms).toEqual([]);
      expect(await readAuthUser(phone)).toBeNull();
    } finally {
      process.env.NEXT_PUBLIC_E2E = previous;
    }
  });

  it('given a text from a number that is not E.164, when processed, then nothing is sent and no account is created', async () => {
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [
        smsInboundEvent({
          from: 'not-a-phone',
          messageSid: 'SM-bad',
        }),
      ],
    });

    expect(result).toEqual({ message: 'invalid phone number' });
    expect(recordedSms).toEqual([]);
  });

  it('given a stranger texts a line, when they reply with a wrong code and then go quiet, then no account remains and no welcome is sent', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone } = claimNumber('+15005550010', testData);
    const line = await createBoundLine(task.id, onTestFinished);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: phone, to: line })],
      steps: [reply(phone, 1, '000000'), silence(2)],
    });

    expect(result).toEqual({
      message: 'timed out waiting for confirmation',
      discard: 'discarded',
    });
    expect(await readAuthUser(phone)).toBeNull();
    expect(recordedSms.map((message) => message.to)).toEqual([phone]);
  });

  it('given a stranger texts a line, when they reply with words first and the code second, then the account is created', async ({
    task,
    onTestFinished,
  }) => {
    const testData = new TestPhoneAuthDataManager(task.id, onTestFinished);
    const { phone, code } = claimNumber('+15005550009', testData);
    const line = await createBoundLine(task.id, onTestFinished);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: phone, to: line })],
      steps: [reply(phone, 1, null), reply(phone, 2, code)],
    });

    const authUser = await readAuthUser(phone);
    expect(authUser?.phoneConfirmedAt).not.toBeNull();
    expect(result).toEqual({
      message: 'account created',
      authUserId: authUser?.id,
      replayed: false,
    });
    expect(recordedSms.map((message) => message.to)).toEqual([phone, phone]);
  });
});
