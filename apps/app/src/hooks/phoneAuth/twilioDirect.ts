import { logger } from '@op/logging/client';
import type { SupabaseClient } from '@supabase/supabase-js';

import type {
  PhoneAuthStrategy,
  PhoneCodeResult,
  PhoneVerifyFailure,
  PhoneVerifyResult,
} from './types';

/** The two procedure calls this strategy needs, injected so it stays testable. */
export interface TwilioDirectCalls {
  startPhoneLogin(input: {
    phone: string;
  }): Promise<{ status: 'pending' | 'rejected' }>;
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
 * Twilio holds the code. The server checks it, mints a session, records the
 * verification, and returns the tokens, which this adopts with `setSession`.
 *
 * This is the default. It costs more code than the Supabase flow and keeps four
 * things that flow gives up. The server can refuse the call behind a feature
 * flag. Our own rate limit applies. A new account can carry a display name.
 * Above all, the server witnesses the approval, and the record it writes is
 * what makes the account a network member.
 *
 * Verify is also exempt from A2P 10DLC, so this works before a campaign is
 * approved.
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
        : { ok: false, reason: 'unreachable' };
    } catch (error) {
      logger.error('Could not start a phone verification', { error });
      return { ok: false, ...describe(error) };
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
        return {
          ok: false,
          reason: result.status === 'expired' ? 'expired' : 'wrong_code',
        };
      }

      const { error } = await supabase.auth.setSession({
        access_token: result.accessToken,
        refresh_token: result.refreshToken,
      });

      if (error) {
        // The code was right and the server issued a real session. Reporting a
        // wrong code here would send the person retyping a correct one.
        logger.error('Could not adopt the minted session', { error });
        return {
          ok: false,
          reason: 'session_failed',
          diagnostic: error.message,
        };
      }

      return { ok: true };
    } catch (error) {
      logger.error('Could not check the phone verification', { error });
      return { ok: false, ...describe(error) };
    }
  },
});

/**
 * Sorts a thrown value into a reason the panel can act on.
 *
 * tRPC gives a rate limit and an unavailable feature the same shape as any
 * other failure, so this reads the message rather than a code. A value that is
 * not an `Error` keeps no identity at all, which is why `unknown` exists.
 */
const describe = (
  error: unknown,
): {
  // The three reasons both result types share, so one reader serves the
  // request path and the check path.
  reason: Extract<
    PhoneVerifyFailure,
    'rate_limited' | 'unavailable' | 'unknown'
  >;
  diagnostic?: string;
} => {
  if (!(error instanceof Error)) {
    return { reason: 'unknown' };
  }
  if (/rate|too many/i.test(error.message)) {
    return { reason: 'rate_limited', diagnostic: error.message };
  }
  if (/not available|not configured/i.test(error.message)) {
    return { reason: 'unavailable', diagnostic: error.message };
  }
  return { reason: 'unknown', diagnostic: error.message };
};
