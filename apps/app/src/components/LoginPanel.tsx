'use client';

import { trpc } from '@op/api/client';
import { getSafeRedirectPath } from '@op/common/client';
import { APP_NAME, OPURLConfig } from '@op/core';
import { useAuthUser, useMount } from '@op/hooks';
import { createSBBrowserClient } from '@op/supabase/client';
import type { Provider } from '@op/supabase/lib';
import { Button, ButtonLink } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { SocialLinks } from '@op/ui/SocialLinks';
import { cn } from '@op/ui/utils';
import { useSearchParams } from 'next/navigation';
import React, { useCallback, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';
import { getOIDCProvider } from '@/lib/oidcProvider';

import {
  AuthCodeField,
  AuthDivider,
  AuthEmailField,
  AuthGoogleButton,
  AuthOIDCButton,
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

  const oidcProvider = getOIDCProvider();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const signInWithProvider = async ({
    provider,
    scopes,
  }: {
    provider: Provider;
    scopes?: string;
  }) => {
    const callbackUrl = new URL('/api/auth/callback', location.origin);

    if (redirectParam !== null) {
      callbackUrl.searchParams.set('redirect', redirectParam);
    }

    setIsRedirecting(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callbackUrl.toString(),
        scopes,
      },
    });

    // signInWithOAuth resolves before the browser navigates away; only a
    // failure to reach the authorize endpoint lands here.
    if (error) {
      setIsRedirecting(false);
      setTokenError(error.message);
    }
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
          <span className="sm:text-base">{t('Welcome to')}</span>
          <span>
            <CommonLogo className="h-8 w-auto" />
          </span>
        </div>
      );
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
    if (isConnectionError) {
      return t(
        "{appName} can't connect to the internet. Please check your internet connection and try again.",
        { appName: APP_NAME },
      );
    }
    if (combinedError || tokenError) {
      return (
        <span className={cn(tokenError && 'text-functional-red')}>
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
              <div className="flex flex-col gap-4">
                <AuthGoogleButton
                  onPress={() => signInWithProvider({ provider: 'google' })}
                  isDisabled={isRedirecting}
                />
                {oidcProvider ? (
                  <AuthOIDCButton
                    providerName={oidcProvider.name}
                    onPress={() =>
                      // Keycloak 20+ requires the openid scope for the
                      // userinfo call; GoTrue appends it to the provider's
                      // default scopes.
                      signInWithProvider({
                        provider: oidcProvider.provider,
                        scopes: 'openid',
                      })
                    }
                    isDisabled={isRedirecting}
                  />
                ) : null}
              </div>
              <AuthDivider />
            </>
          )}

          {!loginSuccess ? (
            <AuthEmailField
              label={t('Organization email')}
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
              onPress={() => {
                void refetchUser().then(({ data }) => {
                  if (data && data.user) {
                    window.location.reload();
                  }
                });
              }}
            >
              {isRefetchingUser ? (
                <div className="m-0.5 aspect-square w-5 animate-spin rounded-full border-2 border-b-0 border-neutral-gray3" />
              ) : (
                t('Try again')
              )}
            </Button>
          ) : (
            <Button
              type="button"
              className="flex w-full items-center justify-center"
              isDisabled={
                !emailIsValid ||
                login.isFetching ||
                (!!token && !isValidOtpLength(token))
              }
              onPress={async () => {
                if (!loginSuccess) {
                  requestEmailCode();
                } else if (loginSuccess && isValidOtpLength(token)) {
                  await handleTokenSubmit();
                }
              }}
            >
              {login.isFetching ? (
                <LoadingSpinner />
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
              color="gradient"
              className="flex w-full items-center justify-center"
            >
              {t('Back to home')}
            </ButtonLink>

            <SocialLinks iconClassName="size-5 stroke-none text-neutral-gray3" />
          </div>
        )}

        {!isConnectionError && !isErrorState && (
          <div className="flex flex-col items-center justify-center text-center text-xs text-darkGray sm:text-sm">
            {isSignup ? (
              <span>
                {t(
                  "You'll receive a code to confirm your account. Can't find it? Check your spam folder.",
                )}
              </span>
            ) : (
              <>
                <span>{t("Don't have an account?")}</span>
                <span>{t('We will automatically create one for you.')}</span>
              </>
            )}
          </div>
        )}
      </section>
    </AuthPanelShell>
  );
};

export default LoginPanel;
