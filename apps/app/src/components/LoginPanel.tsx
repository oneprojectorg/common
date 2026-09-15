'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { usePhoneLoginFlow } from '@/hooks/usePhoneLoginFlow';
import { trpc } from '@op/api/client';
import { getSafeRedirectPath } from '@op/common/client';
import { APP_NAME, OPURLConfig } from '@op/core';
import { useAuthUser, useMount } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { SocialLinks } from '@op/sense/SocialLinks';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { createSBBrowserClient } from '@op/supabase/client';
import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import {
  type AuthChannel,
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
 * Mirrors the composition of `JoinAccountModal` — channel tabs, code-step
 * copy, and the primary/outline/link footer — because both flows send a
 * six-digit code. The auth logic is not shared: this panel signs people in
 * through the invite-only gate; the modal claims accounts around it.
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
  // before. GoTrue answers the browser directly, so this is the only check on
  // the request itself. The same flag is read again on the server, where it
  // decides whether a verified number grants membership.
  const smsLoginEnabled = useFeatureFlag('sms-login');

  // The channel every branch below agrees on.
  //
  // `channel` is restored from sessionStorage, and `useFeatureFlag` reads as
  // off until PostHog resolves. So a returning phone visitor arrives with the
  // flag off and the channel set to phone on every production reload. Deriving
  // one value keeps the rendered
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

  const isPhone = activeChannel === 'phone';
  const isCodeStep = step === 'phone-code' || step === 'email-code';

  // One string read by both the visible subtitle and the live region below,
  // so the announcement cannot drift from what sighted users see.
  const sentTo = isCodeStep
    ? isPhone
      ? t('We sent a code to {phone}', { phone: phoneFlow.normalized })
      : t('We sent a code to {email}', { email })
    : undefined;

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

  const formError = isPhone
    ? phoneFlow.error
    : isCodeStep
      ? tokenError
      : undefined;

  // Email code verification runs straight against Supabase, so only the
  // phone channel has a busy flag for it.
  const isBusy = isPhone ? phoneFlow.isBusy : login.isFetching;

  const verifyCode = () => {
    if (isPhone) {
      void phoneFlow.submitCode();
    } else {
      void handleTokenSubmit();
    }
  };

  const resendCode = () => {
    if (isPhone) {
      void phoneFlow.resend();
    } else {
      setToken(undefined);
      requestEmailCode();
    }
  };

  const backToContact = () => {
    if (isPhone) {
      phoneFlow.changeNumber();
    } else {
      setLoginSuccess(false);
      setToken(undefined);
      setTokenError(undefined);
    }
  };

  // Switching channel abandons whatever was typed in the other one, so a
  // half-entered address cannot be submitted against the wrong endpoint.
  const switchChannel = (next: string) => {
    const nextChannel: AuthChannel | undefined =
      next === 'email' || next === 'phone' ? next : undefined;
    if (!nextChannel || nextChannel === activeChannel) {
      return;
    }
    setChannel(nextChannel);
    setEmail('');
    setPhone('');
    setTokenError(undefined);
  };

  if (!mounted) {
    return null;
  }

  const isConnectionError = user?.error?.name === 'AuthRetryableFetchError';
  const isErrorState = login.isError || !!combinedError;

  const title = (() => {
    if (isConnectionError) {
      return t('Connection issue');
    }
    if (login.isError || error) {
      if (
        combinedError?.includes('invite') ||
        combinedError?.includes('waitlist')
      ) {
        return t('Stay tuned!');
      }
      return t('Oops!');
    }
    if (isCodeStep) {
      return isPhone ? t('Check your texts') : t('Check your email');
    }
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
  })();

  const subtitle = (() => {
    if (isConnectionError) {
      return t(
        "{appName} can't connect to the internet. Please check your internet connection and try again.",
        { appName: APP_NAME },
      );
    }
    if (combinedError) {
      return <span>{combinedError}</span>;
    }
    if (isCodeStep) {
      return sentTo;
    }
    return t(
      'Connect with aligned organizations and funders building a new economy together',
    );
  })();

  return (
    <AuthPanelShell title={title} subtitle={subtitle}>
      {/*
        Announces where the code went: the heading swap and the code field's
        autofocus announce nothing about it. Must stay mounted, empty until
        the code step — a live region only announces a change it was present
        for.
      */}
      <span role="status" className="sr-only">
        {sentTo ?? ''}
      </span>

      {!isConnectionError && !isErrorState && (
        <div className="flex flex-col gap-8">
          {/* role="alert" so failures are announced while focus stays on the
            submit button. */}
          {formError ? (
            <p role="alert" className="text-destructive">
              {formError}
            </p>
          ) : null}

          {!isCodeStep && (
            <>
              <AuthGoogleButton onPress={handleLogin} />
              <AuthDivider />
            </>
          )}

          {isCodeStep ? (
            <AuthCodeField
              value={token}
              isDisabled={isBusy}
              onChange={setToken}
              onSubmit={verifyCode}
            />
          ) : smsLoginEnabled ? (
            <Tabs
              value={activeChannel}
              onValueChange={(next) => {
                switchChannel(next);
              }}
            >
              <span id="login-channel-label" className="text-label">
                {t('Continue with')}
              </span>
              {/* TabsList is `w-fit`; the join dialog splits the full width. */}
              <TabsList
                className="w-full"
                aria-labelledby="login-channel-label"
              >
                <TabsTrigger value="email" className="flex-1">
                  {t('Email')}
                </TabsTrigger>
                <TabsTrigger value="phone" className="flex-1">
                  {t('Phone Number')}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="email">
                <AuthEmailField
                  label={t('Email')}
                  description={t(
                    "We'll email you a code to confirm it's yours.",
                  )}
                  placeholder="name@example.com"
                  value={email}
                  isDisabled={isBusy}
                  onChange={(val) => {
                    setEmailIsValid(emailParser.safeParse(val).success);
                    setEmail(val);
                  }}
                  onSubmit={requestEmailCode}
                />
              </TabsContent>
              <TabsContent value="phone">
                <AuthPhoneField
                  label={t('Phone Number')}
                  description={t("We'll text a code to confirm it's yours.")}
                  value={phone}
                  isDisabled={phoneFlow.isSending}
                  onChange={setPhone}
                  onSubmit={() => {
                    void phoneFlow.requestCode();
                  }}
                />
              </TabsContent>
            </Tabs>
          ) : (
            <AuthEmailField
              label={t('Email')}
              description={t("We'll email you a code to confirm it's yours.")}
              placeholder="name@example.com"
              value={email}
              isDisabled={isBusy}
              onChange={(val) => {
                setEmailIsValid(emailParser.safeParse(val).success);
                setEmail(val);
              }}
              onSubmit={requestEmailCode}
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
          ) : isCodeStep ? (
            <div className="flex flex-col gap-2">
              <Button
                className="w-full"
                loading={isBusy}
                disabled={isBusy || !isValidOtpLength(token)}
                onClick={verifyCode}
              >
                {t('Verify and continue')}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={isBusy}
                onClick={resendCode}
              >
                {t('Resend code')}
              </Button>
              <Button variant="link" disabled={isBusy} onClick={backToContact}>
                {isPhone
                  ? t('Use a different phone number')
                  : t('Use a different email address')}
              </Button>
            </div>
          ) : (
            <Button
              className="w-full"
              loading={isBusy}
              disabled={
                isBusy || (isPhone ? !phoneFlow.isValid : !emailIsValid)
              }
              onClick={() => {
                if (isPhone) {
                  void phoneFlow.requestCode();
                } else {
                  requestEmailCode();
                }
              }}
            >
              {isPhone ? t('Text me a code') : t('Email me a code')}
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

export default LoginPanel;
