import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  PhoneAuthStrategy,
  PhoneCodeResult,
  PhoneVerifyResult,
} from './types';

/** The two procedure calls this strategy needs, injected so it stays testable. */
export interface TwilioDirectCalls {
  startPhoneLogin(input: { phone: string }): Promise<{ status: string }>;
  verifyPhoneLogin(input: {
    phone: string;
    code: string;
    displayName?: string;
  }): Promise<
    | { status: 'approved'; accessToken: string; refreshToken: string }
    | { status: 'rejected' }
    | { status: 'expired' }
  >;
}

/**
 * Signs in through our own procedures, which call Twilio Verify.
 *
 * Twilio holds the code. The server checks it, mints a session, and returns
 * the tokens, which this adopts with `setSession`.
 *
 * Slower to set up than the Supabase flow and more code to keep, but it keeps
 * three things that flow gives up: the server can refuse the call behind a
 * feature flag, our own rate limit applies, and a new account can carry a
 * display name. Verify is also exempt from A2P 10DLC, so this works before a
 * campaign is approved.
 *
 * @param deps.supabase - The browser client, which stores the session.
 * @param deps.calls - The tRPC mutations, already bound by the hook.
 */
export const createTwilioDirectStrategy = ({
  supabase,
  calls,
}: {
  supabase: SupabaseClient;
  calls: TwilioDirectCalls;
}): PhoneAuthStrategy => ({
  requestCode: async (phone: string): Promise<PhoneCodeResult> => {
    try {
      const result = await calls.startPhoneLogin({ phone });
      return result.status === 'pending'
        ? { ok: true }
        : { ok: false, message: 'That number could not be reached.' };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : undefined,
      };
    }
  },

  verifyCode: async ({
    phone,
    code,
    displayName,
  }: {
    phone: string;
    code: string;
    displayName?: string;
  }): Promise<PhoneVerifyResult> => {
    try {
      const result = await calls.verifyPhoneLogin({ phone, code, displayName });

      if (result.status !== 'approved') {
        return { ok: false, expired: result.status === 'expired' };
      }

      const { error } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });

      return error
        ? { ok: false, expired: false, message: error.message }
        : { ok: true };
    } catch (error) {
      return {
        ok: false,
        expired: false,
        message: error instanceof Error ? error.message : undefined,
      };
    }
  },
});
