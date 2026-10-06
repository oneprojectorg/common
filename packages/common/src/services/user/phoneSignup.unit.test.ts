import {
  AuthError,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { parsePhoneNumber } from '../notification/schemas';
import { confirmPhoneSignupCode, requestPhoneSignupCode } from './phoneSignup';

const auth = vi.hoisted(() => ({
  signInWithOtp: vi.fn<SupabaseClient['auth']['signInWithOtp']>(),
  verifyOtp: vi.fn<SupabaseClient['auth']['verifyOtp']>(),
}));

vi.mock('@op/supabase/server', () => ({
  createSBServiceClient: () => ({ auth }),
}));

const PHONE = parsePhoneNumber('+15005550006');

const authUser: User = {
  id: 'auth-user-1',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '2026-09-25T00:00:00.000Z',
};

const noSession = { user: null, session: null } as const;

afterEach(() => {
  vi.clearAllMocks();
});

describe('requestPhoneSignupCode', () => {
  it('given an unknown number, when a code is requested, then GoTrue creates the user unconfirmed and sends the code', async () => {
    auth.signInWithOtp.mockResolvedValue({ data: noSession, error: null });

    const result = await requestPhoneSignupCode({ phone: PHONE });

    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      phone: PHONE,
      options: { shouldCreateUser: true },
    });
    expect(result).toEqual({ status: 'sent' });
  });

  it('given GoTrue throttles the number, when a code is requested, then it reports rate_limited', async () => {
    auth.signInWithOtp.mockResolvedValue({
      data: noSession,
      error: new AuthError(
        `too many requests for ${PHONE}`,
        429,
        'over_sms_send_rate_limit',
      ),
    });

    const result = await requestPhoneSignupCode({ phone: PHONE });

    expect(result).toEqual({ status: 'rejected', reason: 'rate_limited' });
  });

  it('given any other GoTrue error, when a code is requested, then it reports unknown', async () => {
    auth.signInWithOtp.mockResolvedValue({
      data: noSession,
      error: new AuthError('boom', 500, 'sms_send_failed'),
    });

    const result = await requestPhoneSignupCode({ phone: PHONE });

    expect(result).toEqual({ status: 'rejected', reason: 'unknown' });
  });
});

describe('confirmPhoneSignupCode', () => {
  it('given the code GoTrue sent, when confirmed, then GoTrue verifies it and only the auth user id comes back', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: { user: authUser, session: null },
      error: null,
    });

    const result = await confirmPhoneSignupCode({
      phone: PHONE,
      token: '123456',
    });

    expect(auth.verifyOtp).toHaveBeenCalledWith({
      phone: PHONE,
      token: '123456',
      type: 'sms',
    });
    expect(result).toEqual({ status: 'confirmed', authUserId: 'auth-user-1' });
  });

  it('given an expired code, when confirmed, then it reports expired', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: noSession,
      error: new AuthError('Token has expired', 403, 'otp_expired'),
    });

    const result = await confirmPhoneSignupCode({
      phone: PHONE,
      token: '000000',
    });

    expect(result).toEqual({ status: 'rejected', reason: 'expired' });
  });

  it('given a wrong code, when confirmed, then it reports wrong_code', async () => {
    auth.verifyOtp.mockResolvedValue({
      data: noSession,
      error: new AuthError(
        `invalid token for ${PHONE}`,
        400,
        'invalid_credentials',
      ),
    });

    const result = await confirmPhoneSignupCode({
      phone: PHONE,
      token: '000000',
    });

    expect(result).toEqual({ status: 'rejected', reason: 'wrong_code' });
  });

  it('given GoTrue returns neither an error nor a user, when confirmed, then it reports unknown', async () => {
    auth.verifyOtp.mockResolvedValue({ data: noSession, error: null });

    const result = await confirmPhoneSignupCode({
      phone: PHONE,
      token: '123456',
    });

    expect(result).toEqual({ status: 'rejected', reason: 'unknown' });
  });
});
