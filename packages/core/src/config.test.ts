import { afterEach, describe, expect, it, vi } from 'vitest';

const loadAuthOtpLength = async (value: string | undefined) => {
  vi.resetModules();
  vi.stubEnv('AUTH_OTP_LENGTH', value);
  vi.stubEnv('NEXT_PUBLIC_AUTH_OTP_LENGTH', undefined);
  const { AUTH_OTP_LENGTH } = await import('./config');
  return AUTH_OTP_LENGTH;
};

describe('AUTH_OTP_LENGTH', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to 6 when unset', async () => {
    expect(await loadAuthOtpLength(undefined)).toBe(6);
  });

  it('accepts a length shorter than Supabase allows, since Twilio Verify issues the SMS code', async () => {
    expect(await loadAuthOtpLength('4')).toBe(4);
  });

  it('accepts a length longer than ten', async () => {
    expect(await loadAuthOtpLength('12')).toBe(12);
  });

  it('falls back to 6 for a value that is not a positive integer', async () => {
    expect(await loadAuthOtpLength('0')).toBe(6);
    expect(await loadAuthOtpLength('-6')).toBe(6);
    expect(await loadAuthOtpLength('six')).toBe(6);
  });
});
