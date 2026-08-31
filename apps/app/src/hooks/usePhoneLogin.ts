import { trpc } from '@op/api/client';
import { createSBBrowserClient } from '@op/supabase/client';
import { useCallback, useMemo, useState } from 'react';

import { createSupabaseOtpStrategy } from './phoneAuth/supabaseOtp';
import { createTwilioDirectStrategy } from './phoneAuth/twilioDirect';
import type { PhoneCodeResult, PhoneVerifyResult } from './phoneAuth/types';

export type {
  PhoneAuthStrategy,
  PhoneCodeResult,
  PhoneVerifyResult,
} from './phoneAuth/types';

/**
 * Which strategy signs a person in.
 *
 * A deployment setting rather than a rollout. Two people in one release must
 * take the same path, or an incident report cannot say which code ran.
 *
 * `twilio-direct` is the default, because our server has to witness the
 * verification. Network membership reads a row this server writes when a
 * provider approves a number, and only this path produces one. It is also the
 * only path where the SMS sign-in flag, our own rate limit, and a display name
 * on a new account apply.
 *
 * `supabase` remains available and still signs a person in, but GoTrue answers
 * the browser directly and our server never sees the call. An account created
 * that way holds no verification record, so it reaches the product as a
 * non-member.
 */
const strategyName =
  process.env.NEXT_PUBLIC_PHONE_AUTH_STRATEGY === 'supabase'
    ? 'supabase'
    : 'twilio-direct';

/**
 * Signs a person in with a phone number and an SMS code.
 *
 * Selects a strategy and reports progress. The strategies are factories rather
 * than hooks, so this stays the only hook and the choice stays a plain
 * conditional. Both tRPC mutations are created either way and cost nothing
 * until called, which keeps the hook order stable.
 *
 * Progress lives here rather than in a strategy, so both report it the same
 * way whether the work happens on our server or in the browser.
 */
export const usePhoneLogin = () => {
  const supabase = useMemo(() => createSBBrowserClient(), []);
  const start = trpc.account.startPhoneLogin.useMutation();
  const verify = trpc.account.verifyPhoneLogin.useMutation();

  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const strategy = useMemo(
    () =>
      strategyName === 'twilio-direct'
        ? createTwilioDirectStrategy({
            supabase,
            calls: {
              startPhoneLogin: (input) => start.mutateAsync(input),
              verifyPhoneLogin: (input) => verify.mutateAsync(input),
            },
          })
        : createSupabaseOtpStrategy({ supabase }),
    [supabase, start, verify],
  );

  const requestCode = useCallback(
    async (phone: string): Promise<PhoneCodeResult> => {
      setIsSending(true);
      try {
        return await strategy.requestCode(phone);
      } finally {
        setIsSending(false);
      }
    },
    [strategy],
  );

  const verifyCode = useCallback(
    async (input: {
      phone: string;
      code: string;
      displayName?: string;
    }): Promise<PhoneVerifyResult> => {
      setIsVerifying(true);
      try {
        return await strategy.verifyCode(input);
      } finally {
        setIsVerifying(false);
      }
    },
    [strategy],
  );

  return { requestCode, verifyCode, isSending, isVerifying };
};
