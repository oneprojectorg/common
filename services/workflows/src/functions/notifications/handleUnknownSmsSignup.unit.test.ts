import { InngestTestEngine } from '@inngest/test';
import { isFeatureEnabled } from '@op/analytics';
import {
  type SmsProvider,
  confirmPhoneSignupCode,
  discardUnconfirmedPhoneSignup,
  findDecisionPhoneNumber,
  getPhoneSignupState,
  getSmsProvider,
  parsePhoneNumber,
  recordPhoneSignupConsent,
  requestPhoneSignupCode,
} from '@op/common';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/analytics', () => ({ isFeatureEnabled: vi.fn() }));
vi.mock('@op/common', () => {
  class ValidationError extends Error {}
  return {
    confirmPhoneSignupCode: vi.fn(),
    discardUnconfirmedPhoneSignup: vi.fn(),
    findDecisionPhoneNumber: vi.fn(),
    getPhoneSignupState: vi.fn(),
    getSmsProvider: vi.fn(),
    recordPhoneSignupConsent: vi.fn(),
    requestPhoneSignupCode: vi.fn(),
    PHONE_SIGNUP_REPLY_WINDOW_MINUTES: 10,
    parsePhoneNumber: (value: string) => value,
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

import { smsInboundEvent } from '../../../testing/smsInboundEvent';
import { handleUnknownSmsSignup } from './handleUnknownSmsSignup';
import { SMS_COMMANDS_FEATURE_FLAG } from './smsReply';

type SendSms = NonNullable<SmsProvider['sendSms']>;

const FROM = '+15005550006';
const LINE_PHONE = parsePhoneNumber('+15005550999');
const LINE = {
  id: 'line-1',
  phone: LINE_PHONE,
  slug: 'columbus',
  instanceId: 'instance-1',
} as const;

const onLine = (overrides: Parameters<typeof smsInboundEvent>[0]) =>
  smsInboundEvent({ to: LINE_PHONE, ...overrides });

const reply = (attempt: number, code: string | null) => ({
  id: `wait-for-confirmation-${attempt}`,
  handler: () => ({
    data: smsInboundEvent({
      from: FROM,
      code,
      messageSid: `SM-reply-${attempt}`,
    }).data,
  }),
});

const silence = (attempt: number) => ({
  id: `wait-for-confirmation-${attempt}`,
  handler: () => null,
});

const replayDelivered = {
  id: 'replay-original-command',
  handler: () => ({}),
};

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
  vi.mocked(findDecisionPhoneNumber).mockResolvedValue(LINE);
  vi.mocked(getSmsProvider).mockReturnValue({ sendSms });
  vi.mocked(requestPhoneSignupCode).mockResolvedValue({ status: 'sent' });
  vi.mocked(recordPhoneSignupConsent).mockResolvedValue('profile-1');
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

    const { result } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote' })],
    });

    expect(result).toEqual({ message: 'sms signup disabled' });
    expect(getPhoneSignupState).not.toHaveBeenCalled();
    expect(getSmsProvider).not.toHaveBeenCalled();
  });

  it('skips a number that already has a confirmed account', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(getPhoneSignupState).mockResolvedValue(confirmed(1));
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote' })],
    });

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
      events: [onLine({ from: FROM, keyword: 'vote' })],
    });

    expect(result).toEqual({ message: 'signup attempt in progress, skipped' });
    expect(getSmsProvider).not.toHaveBeenCalled();
    expect(requestPhoneSignupCode).not.toHaveBeenCalled();
  });

  it('starts the signup flow for a number whose earlier attempt lapsed', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote' })],
      steps: [silence(1)],
    });

    expect(requestPhoneSignupCode).toHaveBeenCalledWith({ phone: FROM });
    expect(sendSms).toHaveBeenCalledTimes(1);
  });

  it('reports sending as unavailable when no Messaging Service is configured', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(getPhoneSignupState).mockResolvedValue(free);
    vi.mocked(findDecisionPhoneNumber).mockResolvedValue(LINE);
    vi.mocked(getSmsProvider).mockReturnValue({});
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote' })],
    });

    expect(result).toEqual({ message: 'sms sending unavailable' });
    expect(requestPhoneSignupCode).not.toHaveBeenCalled();
  });

  it('given a text from an unknown number off any decision line, then it texts help and starts no signup', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    vi.mocked(findDecisionPhoneNumber).mockResolvedValue(null);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: FROM, keyword: 'vote' })],
    });

    expect(result).toEqual({ message: 'help sent' });
    expect(sendSms).toHaveBeenCalledWith({
      to: FROM,
      body: expect.stringContaining('STOP'),
    });
    expect(sendSms).toHaveBeenCalledWith({
      to: FROM,
      body: expect.not.stringContaining('JOIN'),
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
    vi.mocked(findDecisionPhoneNumber).mockResolvedValue(null);
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: FROM, keyword: 'vote' })],
    });

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
        onLine({
          from: 'not-e164',
          keyword: 'vote',
          messageSid: 'SM1',
        }),
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

    const { result } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote' })],
    });

    expect(result).toEqual({
      message: 'code send rejected',
      reason: 'rate_limited',
    });
    expect(requestPhoneSignupCode).toHaveBeenCalledWith({ phone: FROM });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('names the Terms of Service in the consent text', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote' })],
      steps: [silence(1)],
    });

    expect(sendSms).toHaveBeenCalledWith({
      to: FROM,
      from: LINE_PHONE,
      body: expect.stringContaining('Terms of Service'),
    });
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

    const { result } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote' })],
    });

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

    const { error } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote' })],
    });

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
      events: [onLine({ from: FROM, keyword: 'vote' })],
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
      events: [onLine({ from: FROM })],
      steps: [reply(1, null), reply(2, '123456')],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-2',
      replayed: false,
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
      events: [onLine({ from: FROM, keyword: 'vote' })],
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
      events: [onLine({ from: FROM, keyword: 'vote' })],
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

  it('given a first text with no keyword, when the code confirms, then the welcome names VOTE and nothing replays', async () => {
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
      events: [onLine({ from: FROM })],
      steps: [reply(1, '123456')],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-2',
      replayed: false,
    });
    expect(sendSms).toHaveBeenLastCalledWith({
      to: FROM,
      from: LINE_PHONE,
      body: expect.stringContaining('Text VOTE to register'),
    });
    expect(recordPhoneSignupConsent).toHaveBeenCalledWith({
      authUserId: 'auth-user-2',
    });
  });

  it('given a first text that was a command, when the code confirms, then it replays the command and the welcome names no next step', async () => {
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

    const { result, ctx } = await t.execute({
      events: [
        onLine({ from: FROM, keyword: 'vote', messageSid: 'SM-original' }),
      ],
      steps: [reply(1, '123456'), replayDelivered],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-2',
      replayed: true,
    });
    const welcome = vi.mocked(sendSms).mock.calls.at(-1)?.[0];
    expect(welcome?.body).toContain("You're in");
    expect(welcome?.body).not.toContain('Text VOTE to register');
    expect(ctx.step.sendEvent).toHaveBeenCalledWith(
      'replay-original-command',
      expect.objectContaining({
        id: 'sms-inbound-SM-original-replay',
        data: expect.objectContaining({
          from: FROM,
          keyword: 'vote',
          messageSid: 'SM-original',
        }),
      }),
    );
  });

  it('given a free-text first message, when the code confirms, then the text replays as free text', async () => {
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

    const { result, ctx } = await t.execute({
      events: [onLine({ from: FROM, body: '123', code: null })],
      steps: [reply(1, '123456'), replayDelivered],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-2',
      replayed: true,
    });
    expect(vi.mocked(sendSms).mock.calls.at(-1)?.[0]?.body).toContain(
      'Text VOTE to register',
    );
    expect(ctx.step.sendEvent).toHaveBeenCalledWith(
      'replay-original-command',
      expect.objectContaining({
        data: expect.objectContaining({ body: '123', keyword: null }),
      }),
    );
  });

  it('still reports success and replays the command when only the welcome reply is rejected', async () => {
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

    const { result, ctx } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote', body: 'VOTE' })],
      steps: [reply(1, '123456'), replayDelivered],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-3',
      replayed: true,
    });
    expect(ctx.step.sendEvent).toHaveBeenCalled();
  });

  it('given a chatter first message, when the code confirms, then nothing replays and the welcome names VOTE', async () => {
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

    const { result, ctx } = await t.execute({
      events: [onLine({ from: FROM, body: 'hello there' })],
      steps: [reply(1, '123456')],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-2',
      replayed: false,
    });
    expect(vi.mocked(sendSms).mock.calls.at(-1)?.[0]?.body).toContain(
      'Text VOTE to register',
    );
    expect(ctx.step.sendEvent).not.toHaveBeenCalled();
  });

  it('given the sms-commands flag is off, when the code confirms, then nothing replays and the welcome names VOTE', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    vi.mocked(isFeatureEnabled).mockImplementation(
      async (flag) => flag !== SMS_COMMANDS_FEATURE_FLAG,
    );
    vi.mocked(getPhoneSignupState)
      .mockResolvedValueOnce(free)
      .mockResolvedValueOnce(confirmed(2));
    vi.mocked(confirmPhoneSignupCode).mockResolvedValue({
      status: 'confirmed',
      authUserId: 'auth-user-2',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result, ctx } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote', body: 'VOTE' })],
      steps: [reply(1, '123456')],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-2',
      replayed: false,
    });
    expect(vi.mocked(sendSms).mock.calls.at(-1)?.[0]?.body).toContain(
      'Text VOTE to register',
    );
    expect(ctx.step.sendEvent).not.toHaveBeenCalled();
  });
});
