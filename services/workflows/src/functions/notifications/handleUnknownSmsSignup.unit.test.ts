import { InngestTestEngine } from '@inngest/test';
import { isFeatureEnabled } from '@op/analytics';
import {
  confirmPhoneSignupCode,
  getPhoneSignupState,
  getSmsProvider,
  requestPhoneSignupCode,
} from '@op/common';
import { Events } from '@op/events';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Everything the function's real steps talk to. Steps NOT mocked below run
// their real bodies through `@inngest/test`'s memoized replay, which is what
// lets these tests exercise the actual branching logic rather than a
// hand-rolled re-implementation of it.
vi.mock('@op/analytics', () => ({ isFeatureEnabled: vi.fn() }));
vi.mock('@op/common', () => {
  class ValidationError extends Error {}
  return {
    confirmPhoneSignupCode: vi.fn(),
    getPhoneSignupState: vi.fn(),
    getSmsProvider: vi.fn(),
    requestPhoneSignupCode: vi.fn(),
    PHONE_SIGNUP_REPLY_WINDOW_MINUTES: 10,
    // A real E.164 fixture below, so identity is a faithful stand-in, except
    // for 'not-e164', used to exercise the invalid-number branch.
    safeParsePhoneNumber: (value: string) =>
      value === 'not-e164'
        ? {
            success: false,
            error: new ValidationError('Phone number must be in E.164 format'),
          }
        : { success: true, data: value },
    RateLimitError: class RateLimitError extends Error {},
    ValidationError,
  };
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

const accepted = { status: 'accepted', providerMessageId: 'SM-c' } as const;

const free = { status: 'free' } as const;

const confirmed = (n: number) =>
  ({
    status: 'confirmed',
    authUserId: `auth-user-${n}`,
    profileId: `profile-${n}`,
  }) as const;

const unknownNumberWithProvider = (sendSms = vi.fn()) => {
  vi.mocked(isFeatureEnabled).mockResolvedValue(true);
  vi.mocked(getPhoneSignupState).mockResolvedValue(free);
  vi.mocked(getSmsProvider).mockReturnValue({ sendSms } as never);
  vi.mocked(requestPhoneSignupCode).mockResolvedValue({ status: 'sent' });
  return sendSms;
};

afterEach(() => {
  vi.resetAllMocks();
});

describe('handleUnknownSmsSignup', () => {
  it('skips the signup flow entirely when the feature flag is disabled', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(false);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({ message: 'sms signup disabled' });
    expect(getPhoneSignupState).not.toHaveBeenCalled();
    expect(getSmsProvider).not.toHaveBeenCalled();
  });

  it('skips a number that already has a confirmed account', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(getPhoneSignupState).mockResolvedValue(confirmed(1));
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(getPhoneSignupState).toHaveBeenCalledWith({ phone: FROM });
    expect(result).toEqual({ message: 'known number, skipped' });
    expect(getSmsProvider).not.toHaveBeenCalled();
    expect(requestPhoneSignupCode).not.toHaveBeenCalled();
  });

  it('skips a number whose attempt is in progress, so a reply cannot start another code send', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(getPhoneSignupState).mockResolvedValue({
      status: 'attempt_in_progress',
      codeSentAt: new Date(),
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent('who is this?')],
    });

    expect(result).toEqual({ message: 'signup attempt in progress, skipped' });
    expect(getSmsProvider).not.toHaveBeenCalled();
    expect(requestPhoneSignupCode).not.toHaveBeenCalled();
  });

  it('starts the signup flow for a number whose earlier attempt lapsed', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn().mockResolvedValue(accepted),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    await t.execute({
      events: [triggerEvent()],
      steps: [{ id: 'wait-for-confirmation', handler: () => null }],
    });

    expect(requestPhoneSignupCode).toHaveBeenCalledWith({ phone: FROM });
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it('reports sending as unavailable when no Messaging Service is configured', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(getPhoneSignupState).mockResolvedValue(free);
    vi.mocked(getSmsProvider).mockReturnValue({} as never);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({ message: 'sms sending unavailable' });
    expect(requestPhoneSignupCode).not.toHaveBeenCalled();
  });

  it('skips signup when the inbound number is not valid E.164', async () => {
    const sendSms = unknownNumberWithProvider();
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
    expect(requestPhoneSignupCode).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('asks GoTrue for the code before sending the consent text, and aborts without texting when GoTrue refuses', async () => {
    const sendSms = unknownNumberWithProvider();
    vi.mocked(requestPhoneSignupCode).mockResolvedValue({
      status: 'rejected',
      reason: 'rate_limited',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({
      message: 'code send rejected',
      reason: 'rate_limited',
    });
    expect(requestPhoneSignupCode).toHaveBeenCalledWith({ phone: FROM });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('aborts the signup when the consent text is permanently rejected', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn().mockResolvedValue({
        status: 'rejected',
        reason: 'invalid_number',
        retryable: false,
      }),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({
      message: 'consent send rejected',
      reason: 'invalid_number',
    });
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it('fails the step on a rate-limited consent send, so Inngest retries it', async () => {
    unknownNumberWithProvider(
      vi.fn().mockResolvedValue({
        status: 'rejected',
        reason: 'rate_limited',
        retryable: true,
      }),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { error } = await t.execute({ events: [triggerEvent()] });

    // Inngest serializes a real step failure into a plain {name, message,
    // stack} object rather than handing back a live Error instance.
    expect((error as Error).message).toContain(
      'Consent request send rejected: rate_limited',
    );
  });

  it('reports a timeout when no reply arrives before the wait expires', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn().mockResolvedValue(accepted),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [{ id: 'wait-for-confirmation', handler: () => null }],
    });

    expect(result).toEqual({ message: 'timed out waiting for confirmation' });
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(confirmPhoneSignupCode).not.toHaveBeenCalled();
  });

  it('does not ask GoTrue when the reply does not look like a code', async () => {
    unknownNumberWithProvider(vi.fn().mockResolvedValue(accepted));
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

    expect(result).toEqual({ message: 'reply did not confirm' });
    expect(confirmPhoneSignupCode).not.toHaveBeenCalled();
  });

  it('does not welcome a sender whose code GoTrue rejects', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn().mockResolvedValue(accepted),
    );
    vi.mocked(confirmPhoneSignupCode).mockResolvedValue({
      status: 'rejected',
      reason: 'wrong_code',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [
        {
          id: 'wait-for-confirmation',
          handler: () => confirmationReply('000000'),
        },
      ],
    });

    expect(result).toEqual({ message: 'code rejected', reason: 'wrong_code' });
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it('confirms the texted code with GoTrue and sends a welcome message', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn().mockResolvedValue(accepted),
    );
    vi.mocked(getPhoneSignupState)
      .mockResolvedValueOnce(free) // check-known-number
      .mockResolvedValueOnce(confirmed(2)); // lookup-profile-id
    vi.mocked(confirmPhoneSignupCode).mockResolvedValue({
      status: 'confirmed',
      authUserId: 'auth-user-2',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [
        {
          id: 'wait-for-confirmation',
          handler: () => confirmationReply(' 123 456 '),
        },
      ],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-2',
    });
    expect(confirmPhoneSignupCode).toHaveBeenCalledWith({
      phone: FROM,
      token: '123456',
    });
    expect(sendSms).toHaveBeenCalledTimes(2);
  });

  it('still reports success when only the welcome reply is rejected', async () => {
    unknownNumberWithProvider(
      vi.fn().mockResolvedValueOnce(accepted).mockResolvedValueOnce({
        status: 'rejected',
        reason: 'opted_out',
        retryable: false,
      }),
    );
    vi.mocked(getPhoneSignupState)
      .mockResolvedValueOnce(free)
      .mockResolvedValueOnce(confirmed(3));
    vi.mocked(confirmPhoneSignupCode).mockResolvedValue({
      status: 'confirmed',
      authUserId: 'auth-user-3',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [
        {
          id: 'wait-for-confirmation',
          handler: () => confirmationReply('123456'),
        },
      ],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-3',
    });
  });
});
