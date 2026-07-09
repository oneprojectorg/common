'use client';

import { trpc } from '@op/api/client';
import { isSafeRedirectPath } from '@op/common/client';
import { SUPPORTED_LOCALES } from '@op/common/locales';
import { createSBBrowserClient } from '@op/supabase/client';
import { useCallback } from 'react';

import { i18nConfig } from '@/lib/i18n/config';

/**
 * Claim a full account by linking an email identity (via OTP) onto the
 * visitor's anonymous Supabase user, so anything they created while anonymous
 * stays theirs. With `mintAnonSession`, a visitor with no session at all gets
 * an anonymous user minted first, making this also the signup path for public
 * decision processes — it deliberately never touches `account.login`, so the
 * invite-only allowList gate does not apply.
 *
 * Consumed by `LinkAccountPanel` (/login?link=1) and `JoinAccountModal` (the
 * header "Join" button on public decisions). UI state (steps, errors, i18n)
 * stays in the consumers; this hook only owns the Supabase calls.
 */

export type ClaimEmailResult =
  | { ok: true; needsOtp: boolean }
  | {
      ok: false;
      message: string | undefined;
      /**
       * The current session already belongs to a full account (e.g. the user
       * signed in from another tab while a stale Join button was showing).
       * Consumers translate this into their own copy — proceeding would have
       * started a real email change on the full account.
       */
      alreadySignedIn?: boolean;
    };

export type ClaimVerifyResult =
  | { ok: true }
  | { ok: false; message: string | undefined };

export function useClaimAccount() {
  const supabase = createSBBrowserClient();
  const utils = trpc.useUtils();

  /**
   * Attach `email` to the visitor's anon user. `updateUser({ email })` sends
   * an OTP when email confirmations are on (`needsOtp: true`); with them off
   * the change applies immediately and the session is refreshed so the token
   * drops its stale anonymous claims (`needsOtp: false`).
   *
   * `mintAnonSession` signs in anonymously first when there is no session
   * (the Join modal's public-visitor path). LinkAccountPanel leaves it off:
   * its route requires an anon session at render, and if that session died
   * before submit the claim must fail loudly rather than silently linking the
   * email onto a fresh empty account (orphaning the visitor's proposal).
   */
  const requestEmailCode = useCallback(
    async (
      email: string,
      { mintAnonSession = false }: { mintAnonSession?: boolean } = {},
    ): Promise<ClaimEmailResult> => {
      const { data: sessionData } = await supabase.auth.getSession();
      // A full account has nothing to claim — updateUser here would start a
      // real email change on it. Reachable via a stale-cache Join button
      // (cross-tab sign-in within getMyAccount's staleTime).
      if (sessionData.session && !sessionData.session.user.is_anonymous) {
        return { ok: false, message: undefined, alreadySignedIn: true };
      }
      if (!sessionData.session && mintAnonSession) {
        // Mint an anonymous user to link onto (same as useCreateProposal
        // before attributing a draft).
        const { error } = await supabase.auth.signInAnonymously();
        if (error) {
          return { ok: false, message: error.message };
        }
        // The new session isn't reflected in the cached account query.
        await utils.account.getMyAccount.invalidate();
      }

      // TODO(anon-upgrade): updateUser fails if this email already belongs to
      // another account; we surface the raw Supabase error for now.
      // Productionize with a friendly "that account already exists" path.
      const { data, error } = await supabase.auth.updateUser({ email });
      if (error) {
        return { ok: false, message: error.message };
      }
      // No pending change + email already set ⇒ applied immediately (no OTP).
      // GoTrue lowercases the stored email, so compare case-insensitively or a
      // mixed-case entry would dead-end on an OTP screen with no code sent.
      if (
        data.user?.email === email.trim().toLowerCase() &&
        !data.user?.new_email
      ) {
        await supabase.auth.refreshSession();
        return { ok: true, needsOtp: false };
      }
      return { ok: true, needsOtp: true };
    },
    [supabase, utils],
  );

  /** Confirm the OTP — the claim is an email *change* on the anon user. */
  const verifyEmailCode = useCallback(
    async ({
      email,
      token,
    }: {
      email: string;
      token: string;
    }): Promise<ClaimVerifyResult> => {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email_change',
      });

      if (data.user && data.session && data.user.role === 'authenticated') {
        return { ok: true };
      }
      return { ok: false, message: error?.message };
    },
    [supabase],
  );

  /**
   * After linking, route through promote onboarding (personal details + ToS),
   * returning to `dest` when done. `dest` must carry the locale prefix — the
   * locale-less /login route and the modal both pass a localized pathname.
   */
  const goToOnboarding = useCallback((dest: string | null) => {
    const safeDest = dest && isSafeRedirectPath(dest) ? dest : '/';
    // A safe path isn't necessarily locale-prefixed (e.g. /info/tos), so
    // validate the first segment before building the /start URL from it.
    const firstSegment = safeDest.split('/')[1] ?? '';
    const locale = SUPPORTED_LOCALES.some((l) => l === firstSegment)
      ? firstSegment
      : i18nConfig.defaultLocale;
    window.location.href = `/${locale}/start?promote=1&redirect=${encodeURIComponent(safeDest)}`;
  }, []);

  return { requestEmailCode, verifyEmailCode, goToOnboarding };
}
