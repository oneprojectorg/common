'use client';

import { isSafeRedirectPath } from '@op/common/client';
import { useMount } from '@op/hooks';
import { createSBBrowserClient } from '@op/supabase/client';
import { Button } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { useLocale } from 'next-intl';
import { useQueryState } from 'nuqs';
import React, { useCallback, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import {
  AuthCodeField,
  AuthEmailField,
  AuthPanelShell,
  isValidOtpLength,
  useAuthPanelStore,
} from './AuthPanel';

/**
 * Account-upgrade panel for an anonymous visitor ("link mode"), reached via
 * `/login?link=true` (see PromoteAccountModal). Instead of a brand-new account we
 * *link* an email identity (via OTP) onto the existing anon user, so data they
 * created while anonymous stays theirs. Normal login/signup lives in LoginPanel.
 *
 * TODO(anon-upgrade): Google identity linking is deferred; email + OTP only.
 */
export const LinkAccountPanel = () => {
  const supabase = createSBBrowserClient();
  const t = useTranslations();
  const locale = useLocale();

  const { mounted } = useMount();
  const [redirectParam] = useQueryState('redirect');

  const [linkError, setLinkError] = useState<string | undefined>();
  // Guards against double-submit and drives the button loading state (link mode
  // doesn't run the login query LoginPanel relies on for this).
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

  // After linking, route through onboarding with the page to return to. The
  // /login route is locale-less, so prefix the current locale ourselves.
  const goAfterLink = useCallback(() => {
    const dest = isSafeRedirectPath(redirectParam) ? redirectParam : '/';
    window.location.href = `/${locale}/start?promote=true&redirect=${encodeURIComponent(dest)}`;
  }, [redirectParam, locale]);

  // `updateUser({ email })` attaches the email to the anon user. With email
  // confirmations on it sends an OTP (→ code screen); with them off the change
  // applies immediately, so we refresh the session and continue.
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
        // Refresh so the token drops its stale anonymous claims before we nav.
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

  if (errorMessage) {
    return (
      <AuthPanelShell title={title} subtitle={subtitle}>
        <Button
          className="flex w-full items-center justify-center"
          onPress={() => {
            setLinkError(undefined);
            setTokenError(undefined);
          }}
        >
          {t('Try again')}
        </Button>
      </AuthPanelShell>
    );
  }

  // OTP entry ("Email sent!") — code field, then the Create profile / Go back
  // stack (figma: 24px between field and buttons, 12px between buttons).
  if (loginSuccess) {
    return (
      <AuthPanelShell title={title} subtitle={subtitle}>
        <div className="flex flex-col gap-6">
          <AuthCodeField
            value={token}
            isDisabled={isSubmitting}
            onChange={setToken}
            onSubmit={handleTokenSubmit}
          />
          <div className="flex flex-col gap-3">
            <Button
              type="button"
              className="flex w-full items-center justify-center"
              isDisabled={isSubmitting || !isValidOtpLength(token)}
              onPress={async () => {
                if (isValidOtpLength(token)) {
                  await handleTokenSubmit();
                }
              }}
            >
              {isSubmitting ? <LoadingSpinner /> : t('Create profile')}
            </Button>
            <Button
              color="secondary"
              className="flex w-full items-center justify-center"
              onPress={goBack}
            >
              {t('Go back')}
            </Button>
          </div>
        </div>
      </AuthPanelShell>
    );
  }

  // Create account (email entry) — email + Continue grouped (figma: 16px).
  return (
    <AuthPanelShell title={title} subtitle={subtitle}>
      <div className="flex flex-col gap-4">
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
        <Button
          type="button"
          className="flex w-full items-center justify-center"
          isDisabled={isSubmitting || !emailIsValid}
          onPress={() => {
            void requestEmailCode();
          }}
        >
          {isSubmitting ? <LoadingSpinner /> : t('Continue')}
        </Button>
      </div>
    </AuthPanelShell>
  );
};

export default LinkAccountPanel;
