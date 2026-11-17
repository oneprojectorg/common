import { InngestTestEngine } from '@inngest/test';
import { isFeatureEnabled } from '@op/analytics';
import {
  type SmsProvider,
  confirmPhoneSignupCode,
  createConfirmedPhoneAccount,
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
    createConfirmedPhoneAccount: vi.fn(),
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

const free = { status: 'free' } as const;

// A run parked before this release memoized the bare signup state, so a test
// of that path stubs the step with the old shape.
const parkedLegacyRun = {
  id: 'check-known-number',
  handler: () => free,
};

const accepted = { status: 'accepted', providerMessageId: 'SM-c' } as const;

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
  vi.mocked(createConfirmedPhoneAccount).mockResolvedValue({
    status: 'created',
    authUserId: 'auth-user-2',
  });
  vi.mocked(recordPhoneSignupConsent).mockResolvedValue('profile-1');
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

    const { result } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote' })],
    });

    expect(result).toEqual({ message: 'sms signup disabled' });
    expect(getPhoneSignupState).not.toHaveBeenCalled();
    expect(createConfirmedPhoneAccount).not.toHaveBeenCalled();
  });

  it('given a legacy event with no account field from a confirmed number, then it skips without forwarding', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(getPhoneSignupState).mockResolvedValue(confirmed(1));
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result, ctx } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote' })],
    });

    expect(getPhoneSignupState).toHaveBeenCalledWith({ phone: FROM });
    expect(result).toEqual({ message: 'known number, skipped' });
    expect(ctx.step.sendEvent).not.toHaveBeenCalled();
    expect(createConfirmedPhoneAccount).not.toHaveBeenCalled();
  });

  it('given the webhook saw no account but the number confirmed before this run, then the text is forwarded with the account', async () => {
    vi.mocked(isFeatureEnabled).mockResolvedValue(true);
    vi.mocked(getPhoneSignupState).mockResolvedValue(confirmed(1));
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result, ctx } = await t.execute({
      events: [
        onLine({
          from: FROM,
          keyword: 'show',
          authUserId: null,
          messageSid: 'SM-racing',
        }),
      ],
      steps: [{ id: 'forward-confirmed-command', handler: () => ({}) }],
    });

    expect(result).toEqual({ message: 'known number, forwarded' });
    expect(ctx.step.sendEvent).toHaveBeenCalledWith(
      'forward-confirmed-command',
      expect.objectContaining({
        id: 'sms-inbound-SM-racing-forward',
        data: expect.objectContaining({
          from: FROM,
          keyword: 'show',
          authUserId: 'auth-user-1',
          code: null,
        }),
      }),
    );
    expect(createConfirmedPhoneAccount).not.toHaveBeenCalled();
  });

  it('skips a number whose web signup attempt is in its reply window, so the text cannot steal it', async () => {
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
    expect(createConfirmedPhoneAccount).not.toHaveBeenCalled();
  });

  it('given a stranger texts a decision line, then the account is created confirmed, consent is stamped, and one welcome is sent', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [onLine({ from: FROM })],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-2',
      replayed: false,
    });
    expect(createConfirmedPhoneAccount).toHaveBeenCalledWith({ phone: FROM });
    expect(recordPhoneSignupConsent).toHaveBeenCalledWith({
      authUserId: 'auth-user-2',
    });
    expect(requestPhoneSignupCode).not.toHaveBeenCalled();
    expect(confirmPhoneSignupCode).not.toHaveBeenCalled();
    expect(sendSms).toHaveBeenCalledTimes(1);
    const welcome = vi.mocked(sendSms).mock.calls[0]?.[0];
    expect(welcome?.body).toContain('Terms of Service');
    expect(welcome?.body).toContain('STOP');
    expect(welcome?.body).toContain('Text VOTE to register');
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
    expect(createConfirmedPhoneAccount).not.toHaveBeenCalled();
  });

  it('given a text from an unknown number off any decision line, then it texts help and creates no account', async () => {
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
    expect(createConfirmedPhoneAccount).not.toHaveBeenCalled();
  });

  it('given a help reply that is permanently rejected, then it reports the rejection and creates no account', async () => {
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
    expect(createConfirmedPhoneAccount).not.toHaveBeenCalled();
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
    expect(createConfirmedPhoneAccount).not.toHaveBeenCalled();
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('given GoTrue refuses the account creation, then it reports the rejection and sends nothing', async () => {
    const sendSms = unknownNumberWithProvider();
    vi.mocked(createConfirmedPhoneAccount).mockResolvedValue({
      status: 'rejected',
      reason: 'unknown',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote' })],
    });

    expect(result).toEqual({
      message: 'account create rejected',
      reason: 'unknown',
    });
    expect(sendSms).not.toHaveBeenCalled();
    expect(recordPhoneSignupConsent).not.toHaveBeenCalled();
  });

  it('given a chatter first message, then nothing replays and the welcome names VOTE', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result, ctx } = await t.execute({
      events: [onLine({ from: FROM, body: 'hello there' })],
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

  it('given a proposal-code first message, then it replays as free text and the welcome keeps the registration hint', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result, ctx } = await t.execute({
      events: [onLine({ from: FROM, body: '123', code: null })],
      steps: [replayDelivered],
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

  it('given a first text that was a command, then it replays and the welcome names no next step', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result, ctx } = await t.execute({
      events: [
        onLine({ from: FROM, keyword: 'vote', messageSid: 'SM-original' }),
      ],
      steps: [replayDelivered],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-2',
      replayed: true,
    });
    const welcome = vi.mocked(sendSms).mock.calls.at(-1)?.[0];
    expect(welcome?.body).toContain('Terms of Service');
    expect(welcome?.body).not.toContain('Text VOTE to register');
    expect(ctx.step.sendEvent).toHaveBeenCalledWith(
      'replay-original-command',
      expect.objectContaining({
        id: 'sms-inbound-SM-original-replay',
        data: expect.objectContaining({
          from: FROM,
          keyword: 'vote',
          messageSid: 'SM-original',
          authUserId: 'auth-user-2',
        }),
      }),
    );
  });

  it('still reports success and replays the command when only the welcome reply is rejected', async () => {
    unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue({
        status: 'rejected',
        reason: 'opted_out',
        retryable: false,
      }),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result, ctx } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote', body: 'VOTE' })],
      steps: [replayDelivered],
    });

    expect(result).toEqual({
      message: 'account created',
      authUserId: 'auth-user-2',
      replayed: true,
    });
    expect(ctx.step.sendEvent).toHaveBeenCalled();
  });

  it('given the sms-commands flag is off, then nothing replays and the welcome names VOTE', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    vi.mocked(isFeatureEnabled).mockImplementation(
      async (flag) => flag !== SMS_COMMANDS_FEATURE_FLAG,
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result, ctx } = await t.execute({
      events: [onLine({ from: FROM, keyword: 'vote', body: 'VOTE' })],
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

  it('given a run parked on the code wait before this release, when the code arrives, then the account is created without a consent stamp', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    vi.mocked(confirmPhoneSignupCode).mockResolvedValue({
      status: 'confirmed',
      authUserId: 'auth-user-2',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: FROM })],
      steps: [parkedLegacyRun, reply(1, null), reply(2, '123456')],
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
    expect(createConfirmedPhoneAccount).not.toHaveBeenCalled();
    expect(recordPhoneSignupConsent).not.toHaveBeenCalled();
    expect(sendSms).toHaveBeenCalledTimes(2);
  });

  it('given a parked run, when GoTrue refuses to send the code, then the signup aborts without texting', async () => {
    const sendSms = unknownNumberWithProvider();
    vi.mocked(requestPhoneSignupCode).mockResolvedValue({
      status: 'rejected',
      reason: 'rate_limited',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: FROM })],
      steps: [parkedLegacyRun],
    });

    expect(result).toEqual({
      message: 'code send rejected',
      reason: 'rate_limited',
    });
    expect(sendSms).not.toHaveBeenCalled();
  });

  it('given a parked run, when the consent text is permanently rejected, then the unconfirmed account is discarded', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue({
        status: 'rejected',
        reason: 'invalid_number',
        retryable: false,
      }),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: FROM })],
      steps: [parkedLegacyRun],
    });

    expect(result).toEqual({
      message: 'consent send rejected',
      reason: 'invalid_number',
      discard: 'discarded',
    });
    expect(sendSms).toHaveBeenCalledTimes(1);
    discardedThisAttempt();
  });

  it('given a parked run, when the consent send is rate limited, then the step fails so Inngest retries it', async () => {
    unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue({
        status: 'rejected',
        reason: 'rate_limited',
        retryable: true,
      }),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { error } = await t.execute({
      events: [smsInboundEvent({ from: FROM })],
      steps: [parkedLegacyRun],
    });

    expect(error).toMatchObject({
      message: expect.stringContaining(
        'Consent request send rejected: rate_limited',
      ),
    });
  });

  it('given a parked run, when no reply arrives before the wait expires, then the unconfirmed account is discarded', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: FROM })],
      steps: [parkedLegacyRun, silence(1)],
    });

    expect(result).toEqual({
      message: 'timed out waiting for confirmation',
      discard: 'discarded',
    });
    expect(sendSms).toHaveBeenCalledTimes(1);
    expect(confirmPhoneSignupCode).not.toHaveBeenCalled();
    discardedThisAttempt();
  });

  it('given a parked run, when three replies carry no valid code, then no welcome is sent and the account is discarded', async () => {
    const sendSms = unknownNumberWithProvider(
      vi.fn<SendSms>().mockResolvedValue(accepted),
    );
    vi.mocked(confirmPhoneSignupCode).mockResolvedValue({
      status: 'rejected',
      reason: 'expired_or_invalid',
    });
    const t = new InngestTestEngine({ function: handleUnknownSmsSignup });

    const { result } = await t.execute({
      events: [smsInboundEvent({ from: FROM })],
      steps: [
        parkedLegacyRun,
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
});
