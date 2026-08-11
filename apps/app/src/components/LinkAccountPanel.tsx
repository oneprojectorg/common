'use client';

import {
  getClaimEmailErrorMessage,
  goToOnboarding,
  useClaimAccount,
} from '@/hooks/useClaimAccount';
import { isSafeRedirectPath } from '@op/common/client';
import { useMount } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { Spinner } from '@op/sense/Spinner';
import { CheckIcon } from '@op/sense/icons';
import { useSearchParams } from 'next/navigation';
import React, { useCallback, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  AuthCodeField,
  AuthEmailField,
  AuthPanelShell,
  isValidOtpLength,
  useAuthPanelStore,
} from './AuthPanel';
import { isValidEmail } from './decisions/emailUtils';

/**
 * Account-upgrade panel for an anonymous visitor ("link mode"), reached via
 * `/login?link=1` (see PromoteAccountModal). Instead of a brand-new account we
 * *link* an email identity (via OTP) onto the existing anon user, so data they
 * created while anonymous stays theirs. Normal login/signup lives in LoginPanel.
 *
 * TODO(anon-upgrade): Google identity linking is deferred; email + OTP only.
 */
export const LinkAccountPanel = () => {
  const t = useTranslations();
  const { requestEmailCode, verifyEmailCode } = useClaimAccount();

  const { mounted } = useMount();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

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

  // "Already have an account? Log in" — a real full account can't be linked
  // onto the anon user, so that path drops link mode and goes to normal login.
  const regularLoginHref = isSafeRedirectPath(redirectParam)
    ? `/login?redirect=${encodeURIComponent(redirectParam)}`
    : '/login';

  // After linking, route through onboarding with the page to return to.
  // `redirectParam` carries the locale prefix the locale-less /login route lacks.
  const goAfterLink = useCallback(() => {
    goToOnboarding(redirectParam);
  }, [redirectParam]);

  // Attach the email to the anon user (see useClaimAccount). OTP sent → code
  // screen; applied immediately (confirmations off) → straight to onboarding.
  const submitEmail = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setLinkError(undefined);

    // isSubmitting stays true through goAfterLink so the form can't be
    // re-submitted while window.location is unloading the page.
    try {
      const result = await requestEmailCode(email);
      if (!result.ok) {
        setLinkError(getClaimEmailErrorMessage(result, t));
        setIsSubmitting(false);
        return;
      }
      if (!result.needsOtp) {
        goAfterLink();
        return;
      }
      setLoginSuccess(true);
      setIsSubmitting(false);
    } catch {
      setLinkError(t("That didn't work"));
      setIsSubmitting(false);
    }
  };

  const handleTokenSubmit = useCallback(async () => {
    if (!token || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await verifyEmailCode({ email, token });
      if (result.ok) {
        // Freshly upgraded from anonymous — send them through onboarding.
        // isSubmitting stays true while the page unloads.
        goAfterLink();
        return;
      }
      setTokenError(result.message ?? t('Failed to verify code'));
    } catch {
      setTokenError(t('Failed to verify code'));
    }
    setIsSubmitting(false);
  }, [
    email,
    token,
    isSubmitting,
    goAfterLink,
    setTokenError,
    verifyEmailCode,
    t,
  ]);

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
        <span className="text-headline">{t('Email sent!')}</span>
      </div>
    );
  })();

  const subtitle = (() => {
    if (errorMessage) {
      return (
        <span className={tokenError ? 'text-destructive' : undefined}>
          {errorMessage}
        </span>
      );
    }
    if (!loginSuccess) {
      return t.rich('Already have an account? <login>Log in</login>', {
        login: (chunks: React.ReactNode) => (
          <a href={regularLoginHref} className="text-primary underline">
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
          onClick={() => {
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
              disabled={isSubmitting || !isValidOtpLength(token)}
              onClick={async () => {
                if (isValidOtpLength(token)) {
                  await handleTokenSubmit();
                }
              }}
            >
              {isSubmitting ? (
                <Spinner className="size-6" />
              ) : (
                t('Create profile')
              )}
            </Button>
            <Button
              variant="secondary"
              className="flex w-full items-center justify-center"
              onClick={goBack}
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
            setEmailIsValid(isValidEmail(val));
            setEmail(val);
          }}
          onSubmit={() => {
            void submitEmail();
          }}
        />
        <Button
          type="button"
          className="flex w-full items-center justify-center"
          disabled={isSubmitting || !emailIsValid}
          onClick={() => {
            void submitEmail();
          }}
        >
          {isSubmitting ? <Spinner className="size-6" /> : t('Continue')}
        </Button>
      </div>
    </AuthPanelShell>
  );
};

export default LinkAccountPanel;
