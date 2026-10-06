import { logger, redactPhoneNumbers } from '@op/logging/client';
import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  PhoneAuthStrategy,
  PhoneCodeResult,
  PhoneVerifyResult,
} from './types';

/** GoTrue's code for a verification that is no longer valid. */
const EXPIRED_CODE = 'otp_expired';

/** GoTrue's code for its own per-number send throttle. */
const RATE_LIMITED_CODE = 'over_sms_send_rate_limit';

/**
 * Twilio Verify's code for a number that asked for too many codes. GoTrue
 * relays it as a generic `sms_send_failed`, so it has to be read off the
 * message to be told apart from the service being down.
 *
 * @see https://www.twilio.com/docs/errors/60203
 */
const TWILIO_MAX_SEND_ATTEMPTS = 60203;

/**
 * GoTrue appends Twilio's `more_info` URL to the message when the provider
 * refuses a send. The code at its end is the one Twilio documents, and the
 * only part of the message that is safe to keep verbatim.
 */
const TWILIO_ERROR_URL = /twilio\.com\/docs\/errors\/(\d+)/;

/** The Twilio error code GoTrue relayed in `message`, if the provider refused. */
export const getTwilioErrorCode = (
  message: string | undefined,
): number | undefined => {
  const code = message?.match(TWILIO_ERROR_URL)?.[1];
  return code ? Number(code) : undefined;
};

/**
 * Signs in through Supabase's own phone flow.
 *
 * GoTrue holds the code and hands the message to whichever SMS provider the
 * Supabase config names. It issues the session itself, so nothing here mints
 * one.
 *
 * Two consequences follow from the browser talking to GoTrue directly:
 *
 * - Our server never sees the request, so no server-side rate limit applies.
 *   GoTrue's own limits are the only ones in force.
 * - `displayName` is dropped. `signInWithOtp` does accept `options.data`, and
 *   the signup trigger reads `display_name` from it, so carrying the name is a
 *   gap someone could close rather than a limit of the API.
 *
 * A confirmed number grants no network membership. That reads an email
 * address, which an account created this way does not have.
 *
 * @param deps.supabase - The browser client, which stores the session.
 */
export const createSupabaseOtpStrategy = ({
  supabase,
}: {
  supabase: SupabaseClient;
}): PhoneAuthStrategy => ({
  requestCode: async (phone: string): Promise<PhoneCodeResult> => {
    const { error } = await supabase.auth.signInWithOtp({ phone });

    if (!error) {
      return { ok: true };
    }

    const twilioCode = getTwilioErrorCode(error.message);

    // Never `error` itself: GoTrue's message for this endpoint echoes the
    // phone number back, so the message goes through redaction first.
    logger.error('GoTrue refused to send a code', {
      code: error.code,
      status: error.status,
      twilioCode,
      diagnostic: redactPhoneNumbers(error.message),
    });

    return {
      ok: false,
      reason:
        error.code === RATE_LIMITED_CODE ||
        twilioCode === TWILIO_MAX_SEND_ATTEMPTS
          ? 'rate_limited'
          : error.status === 422
            ? 'unavailable'
            : 'unknown',
      diagnostic: error.message,
    };
  },

  verifyCode: async ({
    phone,
    code,
  }: {
    phone: string;
    code: string;
  }): Promise<PhoneVerifyResult> => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: 'sms',
    });

    if (error) {
      // GoTrue reports an expired verification and a wrong code with the same
      // code, so a wrong code can read as expired here. Asking for a new code
      // still recovers, which a bare "wrong code" would not.
      return {
        ok: false,
        reason: error.code === EXPIRED_CODE ? 'expired' : 'wrong_code',
        diagnostic: error.message,
      };
    }

    if (!data.session) {
      // GoTrue answers without an error and without a session when the code did
      // not match. Nothing else is known, so log it: any other cause reaching
      // here would otherwise be invisible.
      logger.error('GoTrue returned neither an error nor a session');
      return { ok: false, reason: 'wrong_code' };
    }

    return { ok: true };
  },
});
