import { AUTH_EMAIL_OTP_LENGTH, AUTH_SMS_OTP_LENGTH } from '@op/core';
import { describe, expect, it } from 'vitest';

import { isValidOtpLength } from './isValidOtpLength';

describe('isValidOtpLength', () => {
  /**
   * Given no token
   * When either channel checks it
   * Then the check refuses it
   */
  it('refuses an empty token', () => {
    expect(isValidOtpLength(undefined, 'email')).toBe(false);
    expect(isValidOtpLength('', 'email')).toBe(false);
    expect(isValidOtpLength(undefined, 'phone')).toBe(false);
    expect(isValidOtpLength('', 'phone')).toBe(false);
  });

  /**
   * Given a token exactly as long as the email code
   * When the email channel checks it
   * Then the check accepts it
   */
  it('accepts an email token of the configured email length', () => {
    expect(isValidOtpLength('1'.repeat(AUTH_EMAIL_OTP_LENGTH), 'email')).toBe(
      true,
    );
  });

  /**
   * Given a token exactly as long as the SMS code
   * When the phone channel checks it
   * Then the check accepts it
   */
  it('accepts a phone token of the configured SMS length', () => {
    expect(isValidOtpLength('1'.repeat(AUTH_SMS_OTP_LENGTH), 'phone')).toBe(
      true,
    );
  });

  /**
   * Given a token one digit off the channel's length
   * When that channel checks it
   * Then the check refuses it
   */
  it('refuses a token shorter or longer than the channel length', () => {
    expect(
      isValidOtpLength('1'.repeat(AUTH_EMAIL_OTP_LENGTH - 1), 'email'),
    ).toBe(false);
    expect(
      isValidOtpLength('1'.repeat(AUTH_EMAIL_OTP_LENGTH + 1), 'email'),
    ).toBe(false);
    expect(isValidOtpLength('1'.repeat(AUTH_SMS_OTP_LENGTH - 1), 'phone')).toBe(
      false,
    );
    expect(isValidOtpLength('1'.repeat(AUTH_SMS_OTP_LENGTH + 1), 'phone')).toBe(
      false,
    );
  });
});
