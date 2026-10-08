import { InngestTestEngine } from '@inngest/test';
import { isFeatureEnabled } from '@op/analytics';
import {
  type SmsProvider,
  confirmPhoneSignupCode,
  discardUnconfirmedPhoneSignup,
  getPhoneSignupState,
  getSmsProvider,
  requestPhoneSignupCode,
} from '@op/common';
import { Events } from '@op/events';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/analytics', () => ({ isFeatureEnabled: vi.fn() }));
vi.mock('@op/common', () => {
  class ValidationError extends Error {}
  return {
    confirmPhoneSignupCode: vi.fn(),
    discardUnconfirmedPhoneSignup: vi.fn(),
    getPhoneSignupState: vi.fn(),
    getSmsProvider: vi.fn(),
    requestPhoneSignupCode: vi.fn(),
    PHONE_SIGNUP_REPLY_WINDOW_MINUTES: 10,
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

type SendSms = NonNullable<SmsProvider['sendSms']>;

const FROM = '+15005550006';

const triggerEvent = (
  code: string | null = null,
  keyword: 'join' | null = 'join',
) => ({
  name: Events.smsInboundReceived.name,
  data: {
    from: FROM,
    messageSid: 'SM1',
    code,
    keyword,
    argument: null,
    codes: [],
  },
});

const reply = (attempt: number, code: string | null) => ({
  id: `wait-for-confirmation-${attempt}`,
  handler: () => ({
    data: {
      from: FROM,
      messageSid: `SM-reply-${attempt}`,
      code,
      keyword: null,
      argument: null,
      codes: [],
    },
  }),
});

const silence = (attempt: number) => ({
  id: `wait-for-confirmation-${attempt}`,
  handler: () => null,
});

const accepted = { status: 'accepted', providerMessageId: 'SM-c' } as const;

const free = { status: 'free' } as const;

const confirmed = (n: number) =>
  ({
    status: 'confirmed',
    authUserId: `auth-user-${n}`,
    profileId: `profile-${n}`,
  }) as const;

const unknownNumberWithProvider = (sendSms = vi.fn<SendSms>()) => {
  vi.mocked(isFeatureEnabled).mockResolvedValue(true);
  vi.mocked(getPhoneSignupState).mockResolvedValue(free);
  vi.mocked(getSmsProvider).mockReturnValue({ sendSms });
  vi.mocked(requestPhoneSignupCode).mockResolvedValue({ status: 'sent' });
  vi.mocked(discardUnconfirmedPhoneSignup).mockResolvedValue({
    status: 'discarded',
    authUserId: 'auth-user-1',
  });
  return sendSms;
};

const discardedThisAttempt = () =>
  expect(discardUnconfirmedPhoneSignup).toHaveBeenCalledWith({
    phone: FROM,
    codeSentNoLaterThan: expect.any(Date),
  });

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

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({ message: 'signup attempt in progress, skipped' });
    expect(getSmsProvider).not.toHaveBeenCalled();
    expect(requestPhoneSignupCode).not.toHaveBeenCalled();
  });

  it('starts the signup flow for a number whose earlier attempt lapsed', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    await t.execute({ events: [triggerEvent()], steps: [silence(1)] });

    expect(requestPhoneSignupCode).toHaveBeenCalledWith({ phone: FROM });
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it('reports sending as unavailable when no Messaging Service is configured', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(getPhoneSignupState).mockResolvedValue(free);
    vi.mocked(getSmsProvider).mockReturnValue({});
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({ events: [triggerEvent()] });

    expect(result).toEqual({ message: 'sms sending unavailable' });
    expect(requestPhoneSignupCode).not.toHaveBeenCalled();
  });

  it('given a text from an unknown number that is not the JOIN keyword, then it texts help and starts no signup', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({ events: [triggerEvent(null, null)] });

    expect(result).toEqual({ message: 'help sent' });
    expect(sendSms).toHaveBeenCalledWith({
      to: FROM,
      body: expect.stringContaining('JOIN'),
    });
    expect(requestPhoneSignupCode).not.toHaveBeenCalled();
    expect(discardUnconfirmedPhoneSignup).not.toHaveBeenCalled();
  });

  it('given a help reply that is permanently rejected, then it reports the rejection and starts no signup', async () => {
    unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue({
        status: 'rejected',
        reason: 'invalid_number',
        retryable: false,
      }),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({ events: [triggerEvent(null, null)] });

    expect(result).toEqual({
      message: 'help send rejected',
      reason: 'invalid_number',
    });
    expect(requestPhoneSignupCode).not.toHaveBeenCalled();
  });

  it('skips signup when the inbound number is not valid E.164', async () => {
    const sendSms = unknownNumberWithProvider();
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [
        {
          name: Events.smsInboundReceived.name,
          data: {
            from: 'not-e164',
            messageSid: 'SM1',
            code: null,
            keyword: 'join',
            argument: null,
            codes: [],
          },
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
      vi.fn<SendSms>().mockResolvedValue({
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
      discard: 'discarded',
    });
    expect(sendSms).toHaveBeenCalledTimes(1);
    discardedThisAttempt();
  });

  it('fails the step on a rate-limited consent send, so Inngest retries it', async () => {
    unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue({
        status: 'rejected',
        reason: 'rate_limited',
        retryable: true,
      }),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { error } = await t.execute({ events: [triggerEvent()] });

    expect(error).toMatchObject({
      message: expect.stringContaining(
        'Consent request send rejected: rate_limited',
      ),
    });
  });

  it('reports a timeout when no reply arrives before the wait expires', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [silence(1)],
    });

    expect(result).toEqual({
      message: 'timed out waiting for confirmation',
      discard: 'discarded',
    });
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(confirmPhoneSignupCode).not.toHaveBeenCalled();
    discardedThisAttempt();
  });

  it('keeps waiting after a reply that is not a code, then confirms the code that follows', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    vi.mocked(getPhoneSignupState)
      .mockResolvedValueOnce(free)
      .mockResolvedValueOnce(confirmed(2));
    vi.mocked(confirmPhoneSignupCode).mockResolvedValue({
      status: 'confirmed',
      authUserId: 'auth-user-2',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [reply(1, null), reply(2, '123456')],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-2',
    });
    expect(confirmPhoneSignupCode).toHaveBeenCalledTimes(1);
    expect(confirmPhoneSignupCode).toHaveBeenCalledWith({
      phone: FROM,
      token: '123456',
    });
    expect(sendSms).toHaveBeenCalledTimes(2);
  });

  it('keeps waiting after a code GoTrue rejects, and times out without a welcome when nothing valid follows', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    vi.mocked(confirmPhoneSignupCode).mockResolvedValue({
      status: 'rejected',
      reason: 'expired_or_invalid',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [reply(1, '000000'), silence(2)],
    });

    expect(result).toEqual({
      message: 'timed out waiting for confirmation',
      discard: 'discarded',
    });
    expect(confirmPhoneSignupCode).toHaveBeenCalledTimes(1);
    expect(sendSms).toHaveBeenCalledTimes(1);
    discardedThisAttempt();
  });

  it('gives up after three replies with no valid code and sends no welcome', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    vi.mocked(confirmPhoneSignupCode).mockResolvedValue({
      status: 'rejected',
      reason: 'expired_or_invalid',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [
        reply(1, null),
        reply(2, '000000'),
        reply(3, null),
        reply(4, '123456'),
      ],
    });

    expect(result).toEqual({
      message: 'code not confirmed',
      attempts: 3,
      discard: 'discarded',
    });
    expect(confirmPhoneSignupCode).toHaveBeenCalledTimes(1);
    expect(sendSms).toHaveBeenCalledTimes(1);
    discardedThisAttempt();
  });

  it('confirms the texted code with GoTrue and sends a welcome message', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    vi.mocked(getPhoneSignupState)
      .mockResolvedValueOnce(free)
      .mockResolvedValueOnce(confirmed(2));
    vi.mocked(confirmPhoneSignupCode).mockResolvedValue({
      status: 'confirmed',
      authUserId: 'auth-user-2',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [triggerEvent()],
      steps: [reply(1, '123456')],
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
    expect(discardUnconfirmedPhoneSignup).not.toHaveBeenCalled();
  });

  it('still reports success when only the welcome reply is rejected', async () => {
    unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValueOnce(accepted).mockResolvedValueOnce({
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
      steps: [reply(1, '123456')],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-3',
    });
  });
});
