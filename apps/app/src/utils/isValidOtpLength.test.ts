import { AUTH_OTP_LENGTH } from '@op/core';
import { describe, expect, it } from 'vitest';

import { isValidOtpLength } from './isValidOtpLength';

describe('isValidOtpLength', () => {
  it('refuses an empty token', () => {
    expect(isValidOtpLength(undefined)).toBe(false);
    expect(isValidOtpLength('')).toBe(false);
  });

  it("accepts a token exactly as long as the deployment's configured OTP length", () => {
    expect(isValidOtpLength('1'.repeat(AUTH_OTP_LENGTH))).toBe(true);
  });

  it('refuses a token shorter than the configured length', () => {
    expect(isValidOtpLength('1'.repeat(AUTH_OTP_LENGTH - 1))).toBe(false);
  });

  it('refuses a token longer than the configured length', () => {
    expect(isValidOtpLength('1'.repeat(AUTH_OTP_LENGTH + 1))).toBe(false);
  });

  /**
   * Given a Supabase project provisioned with an OTP length other than this
   * deployment's default (e.g. a newly created hosted project defaulting to
   * 8 digits instead of 6 — a real, documented Supabase behavior)
   * When a caller checks a token against that project's actual length
   * Then the check honors the explicit length rather than the deployment default
   */
  it('honors an explicit expected length over the deployment default', () => {
    expect(isValidOtpLength('12345678', 8)).toBe(true);
    expect(isValidOtpLength('123456', 8)).toBe(false);
  });
});
