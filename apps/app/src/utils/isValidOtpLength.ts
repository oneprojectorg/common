import { AUTH_OTP_LENGTH } from '@op/core';

/**
 * Whether a token is exactly as long as the deployment's configured OTP
 * length.
 *
 * The length is a per-deployment setting, not a fixed constant.
 * `expectedLength` defaults to `AUTH_OTP_LENGTH` (see `@op/core`), this
 * deployment's own configured value, so a caller normally doesn't pass it
 * explicitly.
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
