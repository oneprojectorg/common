import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@op/supabase/server', () => ({
  createSBServiceClient: vi.fn(),
}));

import { createSBServiceClient } from '@op/supabase/server';

import { parsePhoneNumber } from '../notification/schemas';
import { confirmPhoneSignupCode, requestPhoneSignupCode } from './phoneSignup';

const PHONE = parsePhoneNumber('+15005550006');

const fakeSupabase = (auth: Record<string, ReturnType<typeof vi.fn>>) => ({
  auth,
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('requestPhoneSignupCode', () => {
  it('given an unknown number, when a code is requested, then GoTrue creates the user unconfirmed and sends the code', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({ data: {}, error: null });
    vi.mocked(createSBServiceClient).mockReturnValue(
      fakeSupabase({ signInWithOtp }) as never,
    );

    const result = await requestPhoneSignupCode({ phone: PHONE });

    expect(signInWithOtp).toHaveBeenCalledWith({
      phone: PHONE,
      options: { shouldCreateUser: true },
    });
    expect(result).toEqual({ status: 'sent' });
  });

  it('given GoTrue throttles the number, when a code is requested, then it reports rate_limited', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({
      data: {},
      error: {
        code: 'over_sms_send_rate_limit',
        status: 429,
        message: `too many requests for ${PHONE}`,
      },
    });
    vi.mocked(createSBServiceClient).mockReturnValue(
      fakeSupabase({ signInWithOtp }) as never,
    );

    const result = await requestPhoneSignupCode({ phone: PHONE });

    expect(result).toEqual({ status: 'rejected', reason: 'rate_limited' });
  });

  it('given any other GoTrue error, when a code is requested, then it reports unknown', async () => {
    const signInWithOtp = vi.fn().mockResolvedValue({
      data: {},
      error: { code: 'sms_send_failed', status: 500, message: 'boom' },
    });
    vi.mocked(createSBServiceClient).mockReturnValue(
      fakeSupabase({ signInWithOtp }) as never,
    );

    const result = await requestPhoneSignupCode({ phone: PHONE });

    expect(result).toEqual({ status: 'rejected', reason: 'unknown' });
  });
});

describe('confirmPhoneSignupCode', () => {
  it('given the code GoTrue sent, when confirmed, then GoTrue verifies it and only the auth user id comes back', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: {
        user: { id: 'auth-user-1' },
        session: { access_token: 'secret' },
      },
      error: null,
    });
    vi.mocked(createSBServiceClient).mockReturnValue(
      fakeSupabase({ verifyOtp }) as never,
    );

    const result = await confirmPhoneSignupCode({
      phone: PHONE,
      token: '123456',
    });

    expect(verifyOtp).toHaveBeenCalledWith({
      phone: PHONE,
      token: '123456',
      type: 'sms',
    });
    expect(result).toEqual({ status: 'confirmed', authUserId: 'auth-user-1' });
  });

  it('given an expired code, when confirmed, then it reports expired', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: { code: 'otp_expired', status: 403, message: 'Token has expired' },
    });
    vi.mocked(createSBServiceClient).mockReturnValue(
      fakeSupabase({ verifyOtp }) as never,
    );

    const result = await confirmPhoneSignupCode({
      phone: PHONE,
      token: '000000',
    });

    expect(result).toEqual({ status: 'rejected', reason: 'expired' });
  });

  it('given a wrong code, when confirmed, then it reports wrong_code', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: {
        code: 'invalid_credentials',
        status: 400,
        message: `invalid token for ${PHONE}`,
      },
    });
    vi.mocked(createSBServiceClient).mockReturnValue(
      fakeSupabase({ verifyOtp }) as never,
    );

    const result = await confirmPhoneSignupCode({
      phone: PHONE,
      token: '000000',
    });

    expect(result).toEqual({ status: 'rejected', reason: 'wrong_code' });
  });

  it('given GoTrue returns neither an error nor a user, when confirmed, then it reports unknown', async () => {
    const verifyOtp = vi.fn().mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
    vi.mocked(createSBServiceClient).mockReturnValue(
      fakeSupabase({ verifyOtp }) as never,
    );

    const result = await confirmPhoneSignupCode({
      phone: PHONE,
      token: '123456',
    });

    expect(result).toEqual({ status: 'rejected', reason: 'unknown' });
  });
});
