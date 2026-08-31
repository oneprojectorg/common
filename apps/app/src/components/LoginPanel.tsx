'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { usePhoneLoginFlow } from '@/hooks/usePhoneLoginFlow';
import { trpc } from '@op/api/client';
import { getSafeRedirectPath } from '@op/common/client';
import { APP_NAME, OPURLConfig } from '@op/core';
import { useAuthUser, useMount } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { SocialLinks } from '@op/sense/SocialLinks';
import { Spinner } from '@op/sense/Spinner';
import { CheckIcon } from '@op/sense/icons';
import { cn } from '@op/sense/lib/utils';
import { createSBBrowserClient } from '@op/supabase/client';
import { useSearchParams } from 'next/navigation';
import React, { useCallback } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import {
  AuthCodeField,
  AuthDivider,
  AuthEmailField,
  AuthGoogleButton,
  AuthPanelShell,
  AuthPhoneField,
  isValidOtpLength,
  useAuthPanelStore,
} from './AuthPanel';
import { CommonLogo } from './CommonLogo';

/** Which of the four screens the panel is showing. */
type LoginStep = 'phone-code' | 'phone-number' | 'email-address' | 'email-code';

/**
 * Standard login / signup panel.
 *
 * The anonymous-account upgrade flow ("link mode") lives in LinkAccountPanel;
 * login/page.tsx routes there when the visitor is anonymous. This component
 * only handles signing into / creating a normal account.
 */
export const LoginPanel = () => {
  const supabase = createSBBrowserClient();
  const t = useTranslations();

  const { mounted } = useMount();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const isSignup = searchParams.get('signup');
  const redirectParam = getSafeRedirectPath(searchParams.get('redirect'));

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
    channel,
    setChannel,
    phone,
    setPhone,
    phoneCodeSent,
    clearPhoneFlow,
  } = useAuthPanelStore();

  /** Lands the visitor wherever the email flow would have landed them. */
  const finishSignIn = useCallback(() => {
    // The phone fields persist, so without this the next visit to /login in
    // this tab opens on a code field for a code already spent.
    clearPhoneFlow();

    if (redirectParam !== null) {
      window.location.href = redirectParam;
    } else {
      window.location.reload();
    }
  }, [redirectParam, clearPhoneFlow]);

  const phoneFlow = usePhoneLoginFlow({ onSignedIn: () => finishSignIn() });

  // Off hides the option entirely, so the panel is the email-only one it was
  // before. On the `twilio-direct` path the server refuses the call as well;
  // on the `supabase` path GoTrue answers the browser and this is the only
  // check, which is why an account created that way holds no verification
  // record and reaches the product as a non-member.
  const smsLoginEnabled = useFeatureFlag('sms-login') ?? false;

  // The channel every branch below agrees on.
  //
  // `channel` is restored from sessionStorage, and `useFeatureFlag` answers
  // `undefined` until PostHog resolves — which `?? false` reads as off. So a
  // returning phone visitor arrives with the flag off and the channel set to
  // phone on every production reload. Deriving one value keeps the rendered
  // field and the submit button from disagreeing; when they disagreed, the
  // panel showed the email field behind a button that only a valid phone
  // number could enable, and neither channel could sign in.
  const activeChannel = smsLoginEnabled ? channel : 'email';

  // Which of the four screens the panel is on.
  //
  // The same question was being asked in four places — the two render
  // branches, the submit button's `disabled`, and its `onClick` — each with
  // its own nesting. They disagreed once already, and the panel became
  // unusable. Deriving it once means a disagreement is no longer expressible.
  const step: LoginStep =
    activeChannel === 'phone'
      ? phoneCodeSent
        ? 'phone-code'
        : 'phone-number'
      : loginSuccess
        ? 'email-code'
        : 'email-address';

  const handleLogin = async () => {
    const callbackUrl = new URL('/api/auth/callback', location.origin);

    if (redirectParam !== null) {
      callbackUrl.searchParams.set('redirect', redirectParam);
    }

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl.toString(),
      },
    });
  };

  const {
    data: user,
    refetch: refetchUser,
    isFetching: isRefetchingUser,
  } = useAuthUser({
    // This is important otherwise we get a loop of refetching
    enabled: false,
  });

  const login = trpc.account.login.useQuery(
    {
      email,
      usingOAuth: false,
    },
    {
      enabled: false,
      staleTime: 0,
      initialData: false,
    },
  );

  const combinedError = (login.error?.message || error) ?? undefined;

  const emailParser = z.email();

  const requestEmailCode = () => {
    void login.refetch().then(({ data }) => {
      if (data) {
        setLoginSuccess(true);
      }
    });
  };

  const handleTokenSubmit = useCallback(async () => {
    if (!token) {
      return;
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    if (data.user && data.session && data.user.role === 'authenticated') {
      finishSignIn();
    } else {
      setTokenError(error?.message ?? t('Failed to verify code'));
    }
  }, [email, token, supabase, finishSignIn, setTokenError, t]);

  // What the shared submit button does on this step.
  const submit = ((): {
    isDisabled: boolean;
    run: () => void | Promise<void>;
    isFinalStep: boolean;
  } => {
    switch (step) {
      case 'phone-number':
        return {
          isDisabled: phoneFlow.isBusy || !phoneFlow.isValid,
          run: phoneFlow.requestCode,
          isFinalStep: false,
        };
      case 'phone-code':
        return {
          isDisabled: phoneFlow.isBusy || !isValidOtpLength(token),
          run: phoneFlow.submitCode,
          isFinalStep: true,
        };
      case 'email-address':
        return {
          isDisabled: !emailIsValid || login.isFetching,
          run: requestEmailCode,
          isFinalStep: false,
        };
      case 'email-code':
        // Deliberately not `!isValidOtpLength(token)`: an empty field leaves
        // the button enabled here, as it always has, and `handleTokenSubmit`
        // returns early. Tightening it is a change to the email flow.
        return {
          isDisabled:
            !emailIsValid ||
            login.isFetching ||
            (!!token && !isValidOtpLength(token)),
          run: async () => {
            if (isValidOtpLength(token)) {
              await handleTokenSubmit();
            }
          },
          isFinalStep: true,
        };
    }
  })();

  if (!mounted) {
    return null;
  }

  const isConnectionError = user?.error?.name === 'AuthRetryableFetchError';
  const isErrorState = login.isError || !!combinedError;

  const title = (() => {
    if (isConnectionError) {
      return t('Connection issue');
    }
    if (login.isError || error || tokenError) {
      if (
        combinedError?.includes('invite') ||
        combinedError?.includes('waitlist')
      ) {
        return t('Stay tuned!');
      }
      return t('Oops!');
    }
    // The phone flow never sets `loginSuccess`, so without this branch the
    // card still reads "Welcome to" while the person stares at a code field.
    if (step === 'phone-code') {
      return (
        <div className="flex flex-col items-center justify-center gap-4">
          <CheckIcon />
          <span className="text-headline">{t('Code sent!')}</span>
        </div>
      );
    }
    if (!loginSuccess) {
      if (isSignup) {
        return t('Sign up to {appName}', { appName: APP_NAME });
      }
      return (
        <div className="flex flex-col gap-2">
          <span className="font-sans text-base font-normal tracking-normal text-muted-foreground">
            {t('Welcome to')}
          </span>
          <span>
            <CommonLogo className="h-8 w-auto" />
          </span>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center gap-4">
        <CheckIcon />
        <span className="text-headline">{t('Email sent!')}</span>
      </div>
    );
  })();

  const subtitle = (() => {
    if (isConnectionError) {
      return t(
        "{appName} can't connect to the internet. Please check your internet connection and try again.",
        { appName: APP_NAME },
      );
    }
    if (combinedError || tokenError) {
      return (
        <span className={cn(tokenError && 'text-destructive')}>
          {combinedError ||
            tokenError ||
            t('There was an error signing you in.')}
        </span>
      );
    }
    if (step === 'phone-code') {
      return (
        <span>
          {t('A code was sent to {phone}. Type the code below to sign in.', {
            phone: phoneFlow.normalized,
          })}
        </span>
      );
    }
    if (!loginSuccess) {
      return t(
        'Connect with aligned organizations and funders building a new economy together',
      );
    }
    return (
      <span>
        {t('A code was sent to {email}. Type the code below to sign in.', {
          email,
        })}
      </span>
    );
  })();

  return (
    <AuthPanelShell title={title} subtitle={subtitle}>
      {!isConnectionError && !isErrorState && (
        <div className="flex flex-col gap-8">
          {!loginSuccess && (
            <>
              <AuthGoogleButton onPress={handleLogin} />
              <AuthDivider />
            </>
          )}

          {step === 'phone-code' ? (
            <div className="flex flex-col gap-4">
              <AuthCodeField
                value={token}
                isDisabled={phoneFlow.isVerifying}
                onChange={setToken}
                onSubmit={phoneFlow.submitCode}
              />
              <PhoneError message={phoneFlow.error} />
              <div className="flex flex-col gap-2">
                <Button
                  variant="link"
                  disabled={phoneFlow.isBusy}
                  onClick={phoneFlow.resend}
                >
                  {t('Send the code again')}
                </Button>
                <Button
                  variant="link"
                  disabled={phoneFlow.isBusy}
                  onClick={phoneFlow.changeNumber}
                >
                  {t('Use a different number')}
                </Button>
              </div>
            </div>
          ) : step === 'phone-number' ? (
            <div className="flex flex-col gap-4">
              <AuthPhoneField
                label={t('Phone number')}
                description={t(
                  'We text you a code. Standard message and data rates may apply.',
                )}
                value={phone}
                isDisabled={phoneFlow.isSending}
                onChange={setPhone}
                onSubmit={phoneFlow.requestCode}
              />
              <PhoneError message={phoneFlow.error} />
              <Button
                variant="link"
                onClick={() => {
                  phoneFlow.changeNumber();
                  setChannel('email');
                }}
              >
                {t('Use an email address instead')}
              </Button>
            </div>
          ) : !loginSuccess ? (
            <div className="flex flex-col gap-4">
              <AuthEmailField
                label={t('Email')}
                description={t(
                  'Use the email address associated with your organization',
                )}
                value={email}
                isDisabled={login.isFetching || loginSuccess || !!combinedError}
                onChange={(val) => {
                  setEmailIsValid(emailParser.safeParse(val).success);
                  setEmail(val);
                }}
                onSubmit={requestEmailCode}
              />
              {smsLoginEnabled && (
                <Button variant="link" onClick={() => setChannel('phone')}>
                  {t('Use a phone number instead')}
                </Button>
              )}
            </div>
          ) : (
            <AuthCodeField
              value={token}
              isDisabled={login.isFetching || !!combinedError}
              onChange={setToken}
              onSubmit={handleTokenSubmit}
            />
          )}
        </div>
      )}

      <section className="flex flex-col gap-6">
        {!isErrorState ? (
          isConnectionError ? (
            <Button
              onClick={() => {
                void refetchUser().then(({ data }) => {
                  if (data && data.user) {
                    window.location.reload();
                  }
                });
              }}
            >
              {isRefetchingUser ? (
                <div className="m-0.5 aspect-square w-5 animate-spin rounded-full border-2 border-b-0 border-input" />
              ) : (
                t('Try again')
              )}
            </Button>
          ) : (
            <Button
              type="button"
              className="flex w-full items-center justify-center"
              disabled={submit.isDisabled}
              onClick={submit.run}
            >
              {login.isFetching || phoneFlow.isBusy ? (
                <Spinner className="size-6" />
              ) : submit.isFinalStep ? (
                isSignup ? (
                  t('Sign up')
                ) : (
                  t('Login')
                )
              ) : (
                t('Sign in')
              )}
            </Button>
          )
        ) : (
          <div className="flex flex-col items-center justify-center gap-4">
            <ButtonLink
              href={`${OPURLConfig('APP').ENV_URL}/login`}
              variant="default"
              className="flex w-full items-center justify-center"
            >
              {t('Back to home')}
            </ButtonLink>

            <SocialLinks iconClassName="size-5 stroke-none text-muted-foreground" />
          </div>
        )}

        {!isConnectionError && !isErrorState && (
          <div className="flex flex-col items-center justify-center text-center text-xs text-muted-foreground sm:text-sm">
            {isSignup ? (
              <span>
                {t(
                  "You'll receive a code to confirm your account. Can't find it? Check your spam folder.",
                )}
              </span>
            ) : (
              <>
                <span>{t("Don't have an account?")}</span>
                <span>
                  {t(
                    'We’ll create one for you with your organization’s email.',
                  )}
                </span>
              </>
            )}
          </div>
        )}
      </section>
    </AuthPanelShell>
  );
};

/**
 * The live region that announces a phone sign-in failure.
 *
 * Always rendered, and empty until there is something to say. A live region
 * that appears at the same moment as its text is usually not announced: a
 * screen reader watches a region it already knows about for changes, so the
 * region has to exist first. `empty:hidden` keeps the blank one from taking
 * space.
 */
const PhoneError = ({ message }: { message?: string }) => (
  <span
    aria-live="polite"
    className="text-destructive empty:hidden"
    role="status"
  >
    {message}
  </span>
);

export default LoginPanel;
