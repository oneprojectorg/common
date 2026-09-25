import { logger } from '@op/logging';
import { createSBServiceClient } from '@op/supabase/server';

import type { PhoneNumber } from '../notification/types';

const RATE_LIMITED_CODE = 'over_sms_send_rate_limit';
const EXPIRED_CODE = 'otp_expired';

/**
 * The outcome of asking GoTrue to text a signup code.
 *
 * `rate_limited` is GoTrue's own per-number throttle. A retry sends another
 * text to a number that may not want one, so callers treat it as final for
 * this run rather than as a reason to try again.
 */
export type PhoneSignupCodeRequest =
  | { status: 'sent' }
  | { status: 'rejected'; reason: 'rate_limited' | 'unknown' };

/**
 * The outcome of handing a texted code back to GoTrue.
 *
 * GoTrue reports an expired verification and a wrong code with one error
 * code, so `expired` is a best reading, as it is in the browser strategy.
 */
export type PhoneSignupConfirmation =
  | { status: 'confirmed'; authUserId: string }
  | { status: 'rejected'; reason: 'expired' | 'wrong_code' | 'unknown' };

/**
 * Asks GoTrue to create an unconfirmed account for `phone` and text it a code.
 *
 * GoTrue owns the code: it generates one, sends it through Twilio Verify and
 * checks the reply, the same way the browser login does (ADR 0004). Nothing
 * here marks the number confirmed; {@link confirmPhoneSignupCode} does that
 * only once GoTrue has accepted the code the holder texted back.
 *
 * @param input.phone - The number to sign up, already validated.
 * @returns Whether GoTrue accepted the request, or why it refused.
 */
export const requestPhoneSignupCode = async ({
  phone,
}: {
  phone: PhoneNumber;
}): Promise<PhoneSignupCodeRequest> => {
  const supabase = createSBServiceClient();

  const { error } = await supabase.auth.signInWithOtp({
    phone,
    options: { shouldCreateUser: true },
  });

  if (!error) {
    return { status: 'sent' };
  }

  logger.warn('GoTrue refused to send a signup code', {
    code: error.code,
    status: error.status,
  });

  return {
    status: 'rejected',
    reason: error.code === RATE_LIMITED_CODE ? 'rate_limited' : 'unknown',
  };
};

/**
 * Hands a texted code to GoTrue, which confirms the number if it matches.
 *
 * GoTrue also issues a session for the new account. The service client is
 * created per call with `persistSession: false`, so that session dies with
 * it; only the auth user id leaves this function.
 *
 * @param input.phone - The number the code was sent to.
 * @param input.token - The code as the person texted it, whitespace removed.
 * @returns The confirmed account's auth user id, or why GoTrue rejected the code.
 */
export const confirmPhoneSignupCode = async ({
  phone,
  token,
}: {
  phone: PhoneNumber;
  token: string;
}): Promise<PhoneSignupConfirmation> => {
  const supabase = createSBServiceClient();

  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    type: 'sms',
  });

  if (error) {
    logger.info('GoTrue rejected a signup code', {
      code: error.code,
      status: error.status,
    });
    return {
      status: 'rejected',
      reason: error.code === EXPIRED_CODE ? 'expired' : 'wrong_code',
    };
  }

  if (!data.user) {
    logger.error(
      'GoTrue returned neither an error nor a user for a signup code',
    );
    return { status: 'rejected', reason: 'unknown' };
  }

  return { status: 'confirmed', authUserId: data.user.id };
};
