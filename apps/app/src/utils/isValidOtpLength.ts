import { type AuthOtpChannel, getAuthOtpLength } from '@op/core';

/**
 * Whether a token is exactly as long as the code the given channel delivers
 * on this deployment.
 *
 * Email codes come from Supabase and SMS codes from Twilio Verify, and each
 * service sets its own length, so the channel decides which length applies
 * (see `getAuthOtpLength` in `@op/core`).
 */
export function isValidOtpLength(
  token: string | undefined,
  channel: AuthOtpChannel,
): boolean {
  if (!token) {
    return false;
  }

  return token.length === getAuthOtpLength(channel);
}
