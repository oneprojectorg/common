import { logger } from '@op/logging/client';
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
 * Signs in through Supabase's own phone flow.
 *
 * GoTrue holds the code and hands the message to whichever SMS provider the
 * Supabase config names. It issues the session itself, so nothing here mints
 * one.
 *
 * Three consequences follow from the browser talking to GoTrue directly:
 *
 * - Our server never sees the request, so no server-side feature flag or rate
 *   limit applies. GoTrue's own limits are the only ones in force.
 * - No verification record is written, so an account created this way signs in
 *   and then reaches the product as a non-member. `twilio-direct` is the
 *   default for that reason.
 * - `displayName` is dropped. `signInWithOtp` does accept `options.data`, and
 *   the signup trigger reads `display_name` from it, so carrying the name is a
 *   gap someone could close rather than a limit of the API.
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

    logger.error('GoTrue refused to send a code', { error });

    return {
      ok: false,
      reason:
        error.code === RATE_LIMITED_CODE
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
