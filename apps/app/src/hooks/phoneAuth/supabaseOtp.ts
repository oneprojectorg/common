import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  PhoneAuthStrategy,
  PhoneCodeResult,
  PhoneVerifyResult,
} from './types';

/** GoTrue's code for a verification that is no longer valid. */
const EXPIRED_CODE = 'otp_expired';

/**
 * Signs in through Supabase's own phone flow.
 *
 * GoTrue holds the code and hands the message to whichever SMS provider the
 * Supabase config names. It issues the session itself, so nothing here mints
 * one.
 *
 * Two consequences follow from the browser talking to GoTrue directly:
 *
 * - Our server never sees the request, so no server-side feature flag or rate
 *   limit applies. GoTrue's own limits are the only ones in force.
 * - `displayName` is dropped. GoTrue creates the account, and this flow cannot
 *   pass metadata to the signup trigger, so a new account is named `User`
 *   until the person edits it.
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
    return error ? { ok: false, message: error.message } : { ok: true };
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
      return {
        ok: false,
        expired: error.code === EXPIRED_CODE,
        message: error.message,
      };
    }

    // GoTrue answers without an error and without a session when the code did
    // not match. Treat a missing session as a refusal rather than a success.
    return data.session
      ? { ok: true }
      : { ok: false, expired: false, message: undefined };
  },
});
