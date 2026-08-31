import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { createSupabaseOtpStrategy } from './supabaseOtp';
import { createTwilioDirectStrategy } from './twilioDirect';

vi.mock('@op/logging/client', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

const PHONE = '+15005550006';

/** A Supabase client stubbed down to the three calls these strategies make. */
const stubClient = (auth: Record<string, unknown>) =>
  ({ auth }) as unknown as SupabaseClient;

describe('createSupabaseOtpStrategy', () => {
  it('reports success when GoTrue accepts the request', async () => {
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({ signInWithOtp: async () => ({ error: null }) }),
    });

    await expect(strategy.requestCode(PHONE)).resolves.toEqual({ ok: true });
  });

  it('separates a send throttle from any other refusal', async () => {
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({
        signInWithOtp: async () => ({
          error: { code: 'over_sms_send_rate_limit', message: 'slow down' },
        }),
      }),
    });

    // "Wait a minute" and "we could not send" are different instructions, and
    // a person who reads the wrong one keeps pressing the button.
    await expect(strategy.requestCode(PHONE)).resolves.toMatchObject({
      ok: false,
      reason: 'rate_limited',
    });
  });

  it('reads an expired verification as expired', async () => {
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({
        verifyOtp: async () => ({
          data: {},
          error: { code: 'otp_expired', message: 'expired' },
        }),
      }),
    });

    await expect(
      strategy.verifyCode({ phone: PHONE, code: '123456' }),
    ).resolves.toMatchObject({ ok: false, reason: 'expired' });
  });

  it('treats a missing session as a refusal rather than a success', async () => {
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({
        // GoTrue answers with neither an error nor a session for a wrong code.
        // Reading that as success would sign nobody in and reload the page
        // into a signed-out state.
        verifyOtp: async () => ({ data: { session: null }, error: null }),
      }),
    });

    await expect(
      strategy.verifyCode({ phone: PHONE, code: '000000' }),
    ).resolves.toMatchObject({ ok: false, reason: 'wrong_code' });
  });

  it('reports success once a session exists', async () => {
    const strategy = createSupabaseOtpStrategy({
      supabase: stubClient({
        verifyOtp: async () => ({
          data: { session: { access_token: 'a' } },
          error: null,
        }),
      }),
    });

    await expect(
      strategy.verifyCode({ phone: PHONE, code: '123456' }),
    ).resolves.toEqual({ ok: true });
  });
});

describe('createTwilioDirectStrategy', () => {
  const build = (
    calls: Partial<Parameters<typeof createTwilioDirectStrategy>[0]['calls']>,
    auth: Record<string, unknown> = { setSession: async () => ({ error: null }) },
  ) =>
    createTwilioDirectStrategy({
      supabase: stubClient(auth),
      calls: {
        startPhoneLogin: async () => ({ status: 'pending' as const }),
        verifyPhoneLogin: async () => ({ status: 'rejected' as const }),
        ...calls,
      },
    });

  it('reports a refused number as unreachable', async () => {
    const strategy = build({
      startPhoneLogin: async () => ({ status: 'rejected' as const }),
    });

    await expect(strategy.requestCode(PHONE)).resolves.toMatchObject({
      ok: false,
      reason: 'unreachable',
    });
  });

  it('sorts a rate-limit error into its own reason', async () => {
    const strategy = build({
      startPhoneLogin: async () => {
        throw new Error('Too many codes were sent to this number.');
      },
    });

    await expect(strategy.requestCode(PHONE)).resolves.toMatchObject({
      ok: false,
      reason: 'rate_limited',
    });
  });

  it('keeps an expired verification apart from a wrong code', async () => {
    const strategy = build({
      verifyPhoneLogin: async () => ({ status: 'expired' as const }),
    });

    await expect(
      strategy.verifyCode({ phone: PHONE, code: '123456' }),
    ).resolves.toMatchObject({ ok: false, reason: 'expired' });
  });

  it('does not call a correct code wrong when the session fails to save', async () => {
    const strategy = build(
      {
        verifyPhoneLogin: async () => ({
          status: 'approved' as const,
          accessToken: 'access',
          refreshToken: 'refresh',
        }),
      },
      { setSession: async () => ({ error: { message: 'storage blocked' } }) },
    );

    // Twilio approved the code and the server minted a real session. Only the
    // browser's write failed. Telling this person their code was wrong sends
    // them retyping a correct one until they give up.
    await expect(
      strategy.verifyCode({ phone: PHONE, code: '123456' }),
    ).resolves.toMatchObject({ ok: false, reason: 'session_failed' });
  });

  it('reports success once the session is adopted', async () => {
    const strategy = build({
      verifyPhoneLogin: async () => ({
        status: 'approved' as const,
        accessToken: 'access',
        refreshToken: 'refresh',
      }),
    });

    await expect(
      strategy.verifyCode({ phone: PHONE, code: '123456' }),
    ).resolves.toEqual({ ok: true });
  });
});
