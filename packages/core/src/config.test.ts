import { afterEach, describe, expect, it, vi } from 'vitest';

const OTP_ENV_NAMES = [
  'AUTH_EMAIL_OTP_LENGTH',
  'NEXT_PUBLIC_AUTH_EMAIL_OTP_LENGTH',
  'AUTH_SMS_OTP_LENGTH',
  'NEXT_PUBLIC_AUTH_SMS_OTP_LENGTH',
] as const;

const loadConfig = async (
  env: Partial<Record<(typeof OTP_ENV_NAMES)[number], string>>,
) => {
  vi.resetModules();
  OTP_ENV_NAMES.forEach((name) => vi.stubEnv(name, env[name]));
  return import('./config');
};

describe('auth OTP lengths', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /**
   * Given no OTP length variable is set
   * When the config loads
   * Then email defaults to the 10 digits the hosted Supabase project sends
   * and SMS to the 6 digits a Verify service sends
   */
  it('defaults email to 10 and SMS to 6 when unset', async () => {
    const { AUTH_EMAIL_OTP_LENGTH, AUTH_SMS_OTP_LENGTH } = await loadConfig({});
    expect(AUTH_EMAIL_OTP_LENGTH).toBe(10);
    expect(AUTH_SMS_OTP_LENGTH).toBe(6);
  });

  /**
   * Given a hosted Supabase project that emails a 10-digit code while the
   * Twilio Verify service still issues a 6-digit code
   * When only the email length is set
   * Then the email length changes and the SMS length keeps its default
   */
  it('reads the email length on its own', async () => {
    const { AUTH_EMAIL_OTP_LENGTH, AUTH_SMS_OTP_LENGTH } = await loadConfig({
      AUTH_EMAIL_OTP_LENGTH: '10',
    });
    expect(AUTH_EMAIL_OTP_LENGTH).toBe(10);
    expect(AUTH_SMS_OTP_LENGTH).toBe(6);
  });

  /**
   * Given a Twilio Verify service configured for 4-digit codes
   * When only the SMS length is set
   * Then the SMS length changes and the email length keeps its default
   */
  it('reads the SMS length on its own', async () => {
    const { AUTH_EMAIL_OTP_LENGTH, AUTH_SMS_OTP_LENGTH } = await loadConfig({
      AUTH_SMS_OTP_LENGTH: '4',
    });
    expect(AUTH_EMAIL_OTP_LENGTH).toBe(10);
    expect(AUTH_SMS_OTP_LENGTH).toBe(4);
  });

  /**
   * Given the browser build only sees NEXT_PUBLIC_ variables
   * When only the NEXT_PUBLIC_ names are set
   * Then each channel reads its NEXT_PUBLIC_ name
   */
  it('reads the NEXT_PUBLIC_ names', async () => {
    const { AUTH_EMAIL_OTP_LENGTH, AUTH_SMS_OTP_LENGTH } = await loadConfig({
      NEXT_PUBLIC_AUTH_EMAIL_OTP_LENGTH: '10',
      NEXT_PUBLIC_AUTH_SMS_OTP_LENGTH: '8',
    });
    expect(AUTH_EMAIL_OTP_LENGTH).toBe(10);
    expect(AUTH_SMS_OTP_LENGTH).toBe(8);
  });

  /**
   * Given a value that is not a positive integer
   * When the config loads
   * Then that channel falls back to its own default
   */
  it('falls back to the channel default for a value that is not a positive integer', async () => {
    const zero = await loadConfig({ AUTH_EMAIL_OTP_LENGTH: '0' });
    expect(zero.AUTH_EMAIL_OTP_LENGTH).toBe(10);

    const negative = await loadConfig({ AUTH_SMS_OTP_LENGTH: '-6' });
    expect(negative.AUTH_SMS_OTP_LENGTH).toBe(6);

    const word = await loadConfig({ AUTH_EMAIL_OTP_LENGTH: 'ten' });
    expect(word.AUTH_EMAIL_OTP_LENGTH).toBe(10);
  });

  /**
   * Given different lengths per channel
   * When a caller asks for a channel's length
   * Then the email channel gets the email length and the phone channel gets the SMS length
   */
  it('resolves a length by channel', async () => {
    const { getAuthOtpLength } = await loadConfig({
      AUTH_EMAIL_OTP_LENGTH: '10',
      AUTH_SMS_OTP_LENGTH: '6',
    });
    expect(getAuthOtpLength('email')).toBe(10);
    expect(getAuthOtpLength('phone')).toBe(6);
  });
});
