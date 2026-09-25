import { InngestTestEngine } from '@inngest/test';
import { isFeatureEnabled } from '@op/analytics';
import { createAccountFromPhone, getSmsProvider } from '@op/common';
import { db } from '@op/db/client';
import { authUsers } from '@op/db/schema';
import { Events } from '@op/events';
import { logger } from '@op/logging';
import { eq } from 'drizzle-orm';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Everything the function's real steps talk to. Steps NOT mocked below run
// their real bodies through `@inngest/test`'s memoized replay, which is what
// lets these tests exercise the actual branching logic rather than a
// hand-rolled re-implementation of it.
vi.mock('@op/analytics', () => ({ isFeatureEnabled: vi.fn() }));
vi.mock('@op/db/client', () => ({ db: { select: vi.fn() } }));
vi.mock('@op/common', () => {
  class ValidationError extends Error {}
  return {
    createAccountFromPhone: vi.fn(),
    getSmsProvider: vi.fn(),
    // A real E.164 fixture below, so identity is a faithful stand-in, except
    // for 'not-e164', used to exercise the invalid-number branch.
    safeParsePhoneNumber: (value: string) =>
      value === 'not-e164'
        ? {
            success: false,
            error: new ValidationError('Phone number must be in E.164 format'),
          }
        : { success: true, data: value },
    // The real transform, not a stand-in: the bug this suite guards against
    // is specifically in what value gets compared against `authUsers.phone`.
    toGoTruePhoneFormat: (value: string) => value.replace(/^\+/, ''),
    RateLimitError: class RateLimitError extends Error {},
    ValidationError,
  };
});
vi.mock('@op/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
// `db` is mocked wholesale above, but the query condition is built by a real
// call to drizzle's `eq`, independent of that mock. Spying on it (rather than
// replacing it) lets a test assert on the exact value compared against
// `authUsers.phone`, which is exactly what the GoTrue `+`-stripping bug got
// wrong.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(actual.eq) };
});

import { handleUnknownSmsSignup } from './handleUnknownSmsSignup';

const FROM = '+15005550006';

const triggerEvent = (body = 'hello') => ({
  name: Events.smsInboundReceived.name,
  data: { from: FROM, body, messageSid: 'SM1' },
});

const confirmationReply = (body: string) => ({
  data: { from: FROM, body, messageSid: 'SM2' },
});

/** A Drizzle `db.select()...` chain stub: any method returns itself, and
 * awaiting it anywhere in the chain resolves to `rows`. */
const dbRows = (rows: unknown[]): never =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (value: unknown) => void) => resolve(rows);
        }
        return () => dbRows(rows);
      },
    },
  ) as never;

afterEach(() => {
  vi.resetAllMocks();
});

describe('handleUnknownSmsSignup', () => {
  it('skips the signup flow entirely when the feature flag is disabled', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({ message: 'sms signup disabled' });
    expect(db.select).not.toHaveBeenCalled();
    expect(getSmsProvider).not.toHaveBeenCalled();
  });

  it('skips a number that already has an account, logging only the profile id', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(db.select).mockReturnValue(
      dbRows([{ authUserId: 'auth-user-1', profileId: 'profile-1' }]),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({ message: 'known number, skipped' });
    expect(logger.info).toHaveBeenCalledWith(
      'Inbound SMS from a known number, skipping signup flow',
      { profileId: 'profile-1' },
    );
    expect(getSmsProvider).not.toHaveBeenCalled();
  });

  it('compares the stored number rather than the leading + Twilio always sends', async () => {
    // GoTrue stores auth.users.phone as '15005550006', never '+15005550006'
    // (confirmed against the local dev database). Comparing FROM's raw '+'
    // form against that column would never match, silently misrouting every
    // known sender into the signup flow.
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(db.select).mockReturnValue(dbRows([]));
    vi.mocked(getSmsProvider).mockReturnValue({} as never);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    await t.execute({ events: [triggerEvent()] });

    const phoneComparison = vi
      .mocked(eq)
      .mock.calls.find(([column]) => column === authUsers.phone);

    expect(phoneComparison?.[1]).toBe('15005550006');
  });

  it('reports sending as unavailable when no Messaging Service is configured', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(db.select).mockReturnValue(dbRows([]));
    vi.mocked(getSmsProvider).mockReturnValue({} as never);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({ message: 'sms sending unavailable' });
  });

  it('skips signup when the inbound number is not valid E.164', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(db.select).mockReturnValue(dbRows([]));
    const sendSms = vi.fn();
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [
        {
          name: Events.smsInboundReceived.name,
          data: { from: 'not-e164', body: 'hello', messageSid: 'SM1' },
        },
      ],
    });

    expect(result).toEqual({ message: 'invalid phone number' });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('aborts the signup when the consent text is permanently rejected', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(db.select).mockReturnValue(dbRows([]));
    const sendSms = vi.fn().mockResolvedValue({
      status: 'rejected',
      reason: 'invalid_number',
      retryable: false,
    });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({
      message: 'consent send rejected',
      reason: 'invalid_number',
    });
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it('fails the step on a rate-limited consent send, so Inngest retries it', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(db.select).mockReturnValue(dbRows([]));
    const sendSms = vi.fn().mockResolvedValue({
      status: 'rejected',
      reason: 'rate_limited',
      retryable: true,
    });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { error } = await t.execute({ events: [triggerEvent()] });

    // Inngest serializes a real step failure into a plain {name, message,
    // stack} object rather than handing back a live Error instance.
    expect((error as Error).message).toContain(
      'Consent request send rejected: rate_limited',
    );
  });

  it('reports a timeout when no reply arrives before the wait expires', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(db.select).mockReturnValue(dbRows([]));
    const sendSms = vi
      .fn()
      .mockResolvedValue({ status: 'accepted', providerMessageId: 'SM-c' });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [{ id: 'wait-for-confirmation', handler: () => null }],
    });

    expect(result).toEqual({ message: 'timed out waiting for confirmation' });
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(createAccountFromPhone).not.toHaveBeenCalled();
  });

  it('does not create an account when the reply is not the confirmation keyword', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(db.select).mockReturnValue(dbRows([]));
    const sendSms = vi
      .fn()
      .mockResolvedValue({ status: 'accepted', providerMessageId: 'SM-c' });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [
        {
          id: 'wait-for-confirmation',
          handler: () => confirmationReply('nope'),
        },
      ],
    });

    expect(result).toEqual({ message: 'reply did not confirm' });
    expect(createAccountFromPhone).not.toHaveBeenCalled();
  });

  it('creates an account and sends a welcome message once the sender confirms', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(db.select)
      .mockReturnValueOnce(dbRows([])) // check-known-number
      .mockReturnValueOnce(dbRows([{ profileId: 'profile-2' }])); // lookup-profile-id
    const sendSms = vi
      .fn()
      .mockResolvedValue({ status: 'accepted', providerMessageId: 'SM-c' });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    vi.mocked(createAccountFromPhone).mockResolvedValue({
      authUserId: 'auth-user-2',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [
        {
          id: 'wait-for-confirmation',
          handler: () => confirmationReply('YES'),
        },
      ],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-2',
    });
    expect(createAccountFromPhone).toHaveBeenCalledWith({ phone: FROM });
    expect(sendSms).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith(
      'Created account from inbound SMS signup',
      { authUserId: 'auth-user-2', profileId: 'profile-2' },
    );
  });

  it('still reports success when only the welcome reply is rejected, without logging the phone number', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(db.select)
      .mockReturnValueOnce(dbRows([]))
      .mockReturnValueOnce(dbRows([{ profileId: 'profile-3' }]));
    const sendSms = vi
      .fn()
      .mockResolvedValueOnce({ status: 'accepted', providerMessageId: 'SM-c' })
      .mockResolvedValueOnce({
        status: 'rejected',
        reason: 'opted_out',
        retryable: false,
      });
    vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
    vi.mocked(createAccountFromPhone).mockResolvedValue({
      authUserId: 'auth-user-3',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [
        {
          id: 'wait-for-confirmation',
          handler: () => confirmationReply('YES'),
        },
      ],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-3',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'Welcome message permanently rejected',
      { authUserId: 'auth-user-3', reason: 'opted_out' },
    );
  });
});
