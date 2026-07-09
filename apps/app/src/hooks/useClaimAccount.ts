'use client';

import { trpc } from '@op/api/client';
import { isSafeRedirectPath } from '@op/common/client';
import { createSBBrowserClient } from '@op/supabase/client';

/**
 * Claim a full account by linking an email identity (via OTP) onto the
 * visitor's anonymous Supabase user, so anything they created while anonymous
 * stays theirs. A visitor with no session at all gets an anonymous user minted
 * first, making this also the signup path for public decision processes — it
 * deliberately never touches `account.login`, so the invite-only allowList
 * gate does not apply.
 *
 * Consumed by `LinkAccountPanel` (/login?link=1) and `JoinAccountModal` (the
 * header "Join" button on public decisions). UI state (steps, errors, i18n)
 * stays in the consumers; this hook only owns the Supabase calls.
 */

export type ClaimEmailResult =
  | { ok: true; needsOtp: boolean }
  | { ok: false; message: string };

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
   */
  const requestEmailCode = async (email: string): Promise<ClaimEmailResult> => {
    // A plain visitor has no session to link onto — mint an anonymous user
    // first (same as useCreateProposal before attributing a draft).
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
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
    if (data.user?.email === email && !data.user?.new_email) {
      await supabase.auth.refreshSession();
      return { ok: true, needsOtp: false };
    }
    return { ok: true, needsOtp: true };
  };

  /** Confirm the OTP — the claim is an email *change* on the anon user. */
  const verifyEmailCode = async ({
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
  };

  /**
   * After linking, route through promote onboarding (personal details + ToS),
   * returning to `dest` when done. `dest` must carry the locale prefix — the
   * locale-less /login route and the modal both pass a localized pathname.
   */
  const goToOnboarding = (dest: string | null) => {
    const safeDest = dest && isSafeRedirectPath(dest) ? dest : '/';
    const locale = safeDest.split('/')[1] || 'en';
    window.location.href = `/${locale}/start?promote=1&redirect=${encodeURIComponent(safeDest)}`;
  };

  return { requestEmailCode, verifyEmailCode, goToOnboarding };
}
