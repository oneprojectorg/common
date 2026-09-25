import { AUTH_OTP_LENGTH } from '@op/core';

/**
 * Whether a token is exactly as long as the deployment's configured OTP
 * length.
 *
 * Supabase's OTP length is a per-project setting (6-10 digits), not a fixed
 * constant — a newly provisioned hosted project can default to 8 digits
 * instead of 6. `expectedLength` defaults to `AUTH_OTP_LENGTH` (see
 * `@op/core`), this deployment's own configured value, so a caller normally
 * doesn't pass it explicitly.
 *
 * @see https://supabase.com/docs/guides/local-development/cli/config#auth.email.otp_length
 */
export function isValidOtpLength(
  token: string | undefined,
  expectedLength: number = AUTH_OTP_LENGTH,
): boolean {
  if (!token) {
    return false;
  }

  return token.length === expectedLength;
}
