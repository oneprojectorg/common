'use client';

import { isSafeRedirectPath } from '@op/common/client';
import { useMount } from '@op/hooks';
import { createSBBrowserClient } from '@op/supabase/client';
import { Button } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { useSearchParams } from 'next/navigation';
import React, { useCallback, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import {
  AuthCodeField,
  AuthEmailField,
  AuthGoogleButton,
  AuthPanelShell,
  isValidOtpLength,
  useAuthPanelStore,
} from './AuthPanel';

/**
 * Account-upgrade panel for an anonymous visitor ("link mode").
 *
 * Reached via `/login?link=1` (see PromoteAccountModal). The visitor already
 * has an anonymous Supabase session; instead of signing into a brand-new
 * account we *link* the chosen identity (Google or email OTP) onto that
 * existing anon user, so any data they created while anonymous (e.g. a
 * just-submitted idea) stays theirs.
 * See https://supabase.com/docs/guides/auth/auth-anonymous.
 *
 * Normal login/signup lives in LoginPanel; login/page.tsx routes here only when
 * the visitor is actually anonymous.
 */
export const LinkAccountPanel = () => {
  const supabase = createSBBrowserClient();
  const t = useTranslations();

  const { mounted } = useMount();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const [linkError, setLinkError] = useState<string | undefined>();
  // Guards the async Supabase calls against double-submit and drives the
  // button's loading state (the login query that LoginPanel leans on for this
  // does not run in link mode).
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    email,
    setEmail,
    emailIsValid,
    setEmailIsValid,
    token,
    setToken,
    tokenError,
    setTokenError,
    loginSuccess,
    setLoginSuccess,
  } = useAuthPanelStore();

  const emailParser = z.email();

  // "Already have an account? Log in" — a real full account can't be linked
  // onto the anon user, so that path drops link mode and goes to normal login.
  const regularLoginHref = isSafeRedirectPath(redirectParam)
    ? `/login?redirect=${encodeURIComponent(redirectParam)}`
    : '/login';

  // After linking, route the freshly-upgraded account through onboarding (which
  // skips org-joining for this flow) and hand it the page to return to.
  // `redirectParam` carries the locale prefix that the locale-less /login route
  // lacks — reuse it for the /start path.
  const goAfterLink = useCallback(() => {
    const dest = isSafeRedirectPath(redirectParam) ? redirectParam : '/';
    const locale = dest.split('/')[1] || 'en';
    window.location.href = `/${locale}/start?promote=1&redirect=${encodeURIComponent(dest)}`;
  }, [redirectParam]);

  // Attach Google to the existing anon user instead of starting a new one.
  const handleGoogle = async () => {
    const callbackUrl = new URL('/api/auth/callback', location.origin);
    if (isSafeRedirectPath(redirectParam)) {
      callbackUrl.searchParams.set('redirect', redirectParam);
    }

    // TODO(anon-upgrade): linkIdentity fails if this Google identity already
    // belongs to another account; we surface the raw Supabase error for now.
    // Productionize with a friendly "that account already exists" path.
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    });
    if (error) {
      setLinkError(error.message);
    }
  };

  // Request the email code. `updateUser({ email })` attaches the email to the
  // current anon user. When email confirmations are enabled it sends an
  // email-change OTP (→ code-entry screen); when they're disabled (e.g. local
  // dev autoconfirm) the change applies immediately with no email, so we just
  // refresh the session and continue.
  const requestEmailCode = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setLinkError(undefined);

    try {
      // TODO(anon-upgrade): updateUser fails if this email already belongs to
      // another account; we surface the raw Supabase error for now.
      // Productionize with a friendly "that account already exists" path.
      const { data, error } = await supabase.auth.updateUser({ email });
      if (error) {
        setLinkError(error.message);
        return;
      }
      // No pending change + email already set ⇒ applied immediately (no OTP).
      if (data.user?.email === email && !data.user?.new_email) {
        // The email change applied immediately, but the current access token
        // still carries the stale anonymous claims — refresh it so the app sees
        // the upgraded (non-anonymous) identity before navigating.
        await supabase.auth.refreshSession();
        goAfterLink();
        return;
      }
      setLoginSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTokenSubmit = useCallback(async () => {
    if (!token || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Link mode confirms an email *change* on the anon user.
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email_change',
      });

      if (data.user && data.session && data.user.role === 'authenticated') {
        // Freshly upgraded from anonymous — send them through onboarding.
        goAfterLink();
        return;
      }
      setTokenError(error?.message ?? t('Failed to verify code'));
    } finally {
      setIsSubmitting(false);
    }
  }, [email, token, isSubmitting, goAfterLink, setTokenError, supabase, t]);

  // "Go back" from the code screen returns to email entry without losing the
  // anon session (only the success/token state is cleared).
  const goBack = () => {
    setLoginSuccess(false);
    setToken(undefined);
    setTokenError(undefined);
    setLinkError(undefined);
  };

  if (!mounted) {
    return null;
  }

  const errorMessage = linkError || tokenError;

  const title = (() => {
    if (errorMessage) {
      return t('Oops!');
    }
    if (!loginSuccess) {
      return t('Create an account');
    }
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <CheckIcon />
        <span className="text-title-base sm:text-title-lg">
          {t('Email sent!')}
        </span>
      </div>
    );
  })();

  const subtitle = (() => {
    if (errorMessage) {
      return (
        <span className={tokenError ? 'text-functional-red' : undefined}>
          {errorMessage}
        </span>
      );
    }
    if (!loginSuccess) {
      return t.rich('Already have an account? <login>Log in</login>', {
        login: (chunks: React.ReactNode) => (
          <a href={regularLoginHref} className="text-primary-teal underline">
            {chunks}
          </a>
        ),
      });
    }
    return (
      <span>
        {t(
          'A code was sent to {email}. Type the code below to create your profile.',
          {
            email,
          },
        )}
      </span>
    );
  })();

  return (
    <AuthPanelShell title={title} subtitle={subtitle}>
      {!errorMessage && (
        <div className="flex flex-col gap-8">
          {!loginSuccess && <AuthGoogleButton onPress={handleGoogle} />}

          {!loginSuccess ? (
            <AuthEmailField
              label={t('Email')}
              value={email}
              isDisabled={isSubmitting}
              onChange={(val) => {
                setEmailIsValid(emailParser.safeParse(val).success);
                setEmail(val);
              }}
              onSubmit={() => {
                void requestEmailCode();
              }}
            />
          ) : (
            <AuthCodeField
              value={token}
              isDisabled={isSubmitting}
              onChange={setToken}
              onSubmit={handleTokenSubmit}
            />
          )}
        </div>
      )}

      <section className="flex flex-col gap-6">
        <Button
          type="button"
          className="flex w-full items-center justify-center"
          isDisabled={
            isSubmitting ||
            (!loginSuccess && !emailIsValid) ||
            (!!token && !isValidOtpLength(token))
          }
          onPress={async () => {
            if (!loginSuccess) {
              void requestEmailCode();
            } else if (isValidOtpLength(token)) {
              await handleTokenSubmit();
            }
          }}
        >
          {isSubmitting ? (
            <LoadingSpinner />
          ) : loginSuccess ? (
            t('Create profile')
          ) : (
            t('Continue')
          )}
        </Button>

        {loginSuccess && (
          <Button
            color="secondary"
            className="flex w-full items-center justify-center"
            onPress={goBack}
          >
            {t('Go back')}
          </Button>
        )}
      </section>
    </AuthPanelShell>
  );
};

export default LinkAccountPanel;
