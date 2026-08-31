import { trpc } from '@op/api/client';
import { createSBBrowserClient } from '@op/supabase/client';
import { useCallback } from 'react';

/** What `requestCode` reports back to the panel. */
export type PhoneCodeResult = { ok: true } | { ok: false; message?: string };

/** What `verifyCode` reports back to the panel. */
export type PhoneVerifyResult =
  | { ok: true }
  | { ok: false; expired: boolean; message?: string };

/**
 * Signs a person in with a phone number and an SMS code.
 *
 * Twilio Verify owns the code. The server asks Twilio to send one, and asks
 * Twilio to check it, so this hook never sees a code beyond passing it on.
 *
 * The server returns tokens rather than setting a cookie, so this hook adopts
 * them with `setSession`. That writes the session through the same storage the
 * rest of the app reads, and no page works until it does.
 *
 * Mirrors {@link useClaimAccount}, which pairs a request step with a verify
 * step for email.
 */
export const usePhoneLogin = () => {
  const supabase = createSBBrowserClient();
  const start = trpc.account.startPhoneLogin.useMutation();
  const verify = trpc.account.verifyPhoneLogin.useMutation();

  /** Asks Twilio to text a code to `phone`. */
  const requestCode = useCallback(
    async (phone: string): Promise<PhoneCodeResult> => {
      try {
        const result = await start.mutateAsync({ phone });
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
    [start],
  );

  /**
   * Checks the code and adopts the session.
   *
   * Separates a wrong code from an expired verification, because the two need
   * opposite instructions: type it again, or request a new one.
   */
  const verifyCode = useCallback(
    async ({
      phone,
      code,
      displayName,
    }: {
      phone: string;
      code: string;
      displayName?: string;
    }): Promise<PhoneVerifyResult> => {
      try {
        const result = await verify.mutateAsync({ phone, code, displayName });

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
    [verify, supabase],
  );

  return {
    requestCode,
    verifyCode,
    isSending: start.isPending,
    isVerifying: verify.isPending,
  };
};
