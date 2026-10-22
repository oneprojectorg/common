import { describe, expect, it } from 'vitest';

import { toVerifyResult } from './verifyResult';

describe('toVerifyResult', () => {
  it('reports success once a session exists', () => {
    expect(
      toVerifyResult({ data: { session: { access_token: 'a' } }, error: null }),
    ).toEqual({ ok: true });
  });

  it('reads an expired verification as expired', () => {
    expect(
      toVerifyResult({
        data: { session: null },
        error: {
          code: 'otp_expired',
          message: 'Token has expired or is invalid',
        },
      }),
    ).toEqual({ ok: false, reason: 'expired' });
  });

  it('reads any other refusal as a wrong code', () => {
    expect(
      toVerifyResult({
        data: { session: null },
        error: { code: 'validation_failed', message: 'bad token' },
      }),
    ).toEqual({ ok: false, reason: 'wrong_code' });
  });

  it('treats a missing session with no error as a wrong code', () => {
    expect(toVerifyResult({ data: { session: null }, error: null })).toEqual({
      ok: false,
      reason: 'wrong_code',
    });
  });

  it('never carries the vendor message, even when it names the number and the account', () => {
    const result = toVerifyResult({
      data: { session: null },
      error: {
        code: 'otp_expired',
        message:
          'Token has expired or is invalid for +15005550006 on ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    });

    expect(result).toEqual({ ok: false, reason: 'expired' });
    expect(result).not.toHaveProperty('message');
    expect(result).not.toHaveProperty('diagnostic');
  });
});
