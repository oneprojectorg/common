'use client';

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
  isValidOtpLength,
  useAuthPanelStore,
} from './AuthPanel';
import { CommonLogo } from './CommonLogo';

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
  } = useAuthPanelStore();

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
      if (redirectParam !== null) {
        window.location.href = redirectParam;
      } else {
        window.location.reload();
      }
    } else {
      setTokenError(error?.message ?? t('Failed to verify code'));
    }
  }, [email, token]);

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

          {!loginSuccess ? (
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
              disabled={
                !emailIsValid ||
                login.isFetching ||
                (!!token && !isValidOtpLength(token))
              }
              onClick={async () => {
                if (!loginSuccess) {
                  requestEmailCode();
                } else if (loginSuccess && isValidOtpLength(token)) {
                  await handleTokenSubmit();
                }
              }}
            >
              {login.isFetching ? (
                <Spinner className="size-6" />
              ) : loginSuccess ? (
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

export default LoginPanel;
