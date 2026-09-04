import { createSBBrowserClient } from '@op/supabase/client';
import { useCallback, useMemo, useState } from 'react';

import { createSupabaseOtpStrategy } from './phoneAuth/supabaseOtp';
import type { PhoneCodeResult, PhoneVerifyResult } from './phoneAuth/types';

export type {
  PhoneAuthStrategy,
  PhoneCodeResult,
  PhoneVerifyResult,
} from './phoneAuth/types';

/**
 * Signs a person in with a phone number and an SMS code.
 *
 * GoTrue owns the code. It generates one, hands it to Twilio Verify, checks the
 * reply, and issues the session, so neither this hook nor our server ever holds
 * a code. The browser talks to Supabase directly.
 *
 * Signing in here authenticates someone and admits them nowhere. Network
 * membership reads an email address, and an account created this way holds
 * none.
 *
 * The work sits behind {@link PhoneAuthStrategy} so a later provider change is
 * one new file rather than a rewrite of the panel. One implementation exists,
 * which is why nothing chooses between them.
 *
 * Progress lives here rather than in the strategy, so the panel reads it the
 * same way whoever does the work.
 */
export const usePhoneLogin = () => {
  const supabase = useMemo(() => createSBBrowserClient(), []);
  const strategy = useMemo(
    () => createSupabaseOtpStrategy({ supabase }),
    [supabase],
  );

  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

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
