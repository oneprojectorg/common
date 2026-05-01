'use client';

import { trpc } from '@op/api/client';
import { isSafeRedirectPath } from '@op/common/client';
import { APP_NAME, OPURLConfig } from '@op/core';
import { useAuthUser, useMount } from '@op/hooks';
import { createSBBrowserClient } from '@op/supabase/client';
import { Button, ButtonLink } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { Form } from '@op/ui/Form';
import { Header1 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { SocialLinks } from '@op/ui/SocialLinks';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';
import { useSearchParams } from 'next/navigation';
import React, { useCallback } from 'react';
import { FcGoogle as GoogleIcon } from 'react-icons/fc';
import { z } from 'zod';
import { create } from 'zustand';

import { useTranslations } from '@/lib/i18n';

import { CommonLogo } from './CommonLogo';

interface LoginState {
  email: string;
  setEmail: (email: string) => void;
  emailIsValid: boolean;
  setEmailIsValid: (emailIsValid: boolean) => void;
  token: string | undefined;
  setToken: (token: string | undefined) => void;
  tokenError: string | undefined;
  setTokenError: (tokenError: string | undefined) => void;
  loginSuccess: boolean;
  setLoginSuccess: (loginSuccess: boolean) => void;
  reset: () => void;
}

const useLoginStore = create<LoginState>((set) => ({
  email: '',
  setEmail: (email) => set({ email }),
  emailIsValid: false,
  setEmailIsValid: (emailIsValid) => set({ emailIsValid }),
  token: undefined,
  setToken: (token) => set({ token }),
  tokenError: undefined,
  setTokenError: (tokenError) => set({ tokenError }),
  loginSuccess: false,
  setLoginSuccess: (loginSuccess) => set({ loginSuccess }),
  reset: () =>
    set({
      email: '',
      emailIsValid: false,
      token: undefined,
      tokenError: undefined,
      loginSuccess: false,
    }),
}));

export const LoginPanel = () => {
  const supabase = createSBBrowserClient();
  const t = useTranslations();

  const { mounted } = useMount();
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const isSignup = searchParams.get('signup');
  const redirectParam = searchParams.get('redirect');

  const urlErrorMessage = (() => {
    switch (errorCode) {
      case null:
        return undefined;
      case 'not_invited':
        return `${APP_NAME} is invite-only. You’re now on the waitlist — keep an eye on your inbox for updates.`;
      case 'invalid_email':
        return 'We couldn’t read the email on your account. Please try a different sign-in method.';
      case 'oauth_cancelled':
        return 'Sign-in was cancelled. Please try again.';
      case 'oauth_failed':
        return 'We couldn’t complete sign-in with your provider. Please try again.';
      case 'no_email':
        return 'Your account didn’t share an email address. Please try a different sign-in method.';
      default:
        return 'There was an error signing you in.';
    }
  })();
  const isWaitlistError = errorCode === 'not_invited';

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
  } = useLoginStore();

  const handleLogin = async () => {
    const callbackUrl = new URL('/api/auth/callback', location.origin);

    if (isSafeRedirectPath(redirectParam)) {
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

  const combinedError = (login.error?.message || urlErrorMessage) ?? undefined;
  const isInviteRelatedError =
    isWaitlistError ||
    combinedError?.includes('invite') ||
    combinedError?.includes('waitlist');

  const emailParser = z.email();

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
      if (isSafeRedirectPath(redirectParam)) {
        window.location.href = redirectParam;
      } else {
        window.location.reload();
      }
    } else {
      setTokenError(error?.message ?? t('Failed to verify code'));
    }
  }, [email, token]);

  if (!mounted) return null;

  // TODO: using a tailwind v4 class here "min-w-xs"
  return (
    <div className="flex items-center justify-center sm:block">
      <div className="z-[999999] max-h-full w-auto min-w-xs rounded-lg border-offWhite bg-white bg-clip-padding px-4 py-8 font-sans text-neutral-gray4 xs:w-96 sm:border-0">
        <div className="flex flex-col gap-12 sm:gap-8">
          <section className="flex flex-col items-center justify-center gap-2 sm:gap-4">
            <Header1 className="text-center">
              {user?.error?.name === 'AuthRetryableFetchError'
                ? t('Connection issue')
                : (() => {
                    if (login.isError || combinedError || tokenError) {
                      if (isInviteRelatedError) {
                        return t('Stay tuned!');
                      }

                      return t('Oops!');
                    }

                    if (!loginSuccess) {
                      if (isSignup) {
                        return t('Sign up to {appName}', {
                          appName: APP_NAME,
                        });
                      }

                      return (
                        <div className="flex flex-col gap-2">
                          <span className="sm:text-base">
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
                        <span className="text-title-base sm:text-title-lg">
                          {t('Email sent!')}
                        </span>
                      </div>
                    );
                  })()}
            </Header1>

            <div className="px-4 text-center text-sm leading-[130%] text-neutral-gray4 sm:text-base">
              {user?.error?.name === 'AuthRetryableFetchError'
                ? t(
                    "{appName} can't connect to the internet. Please check your internet connection and try again.",
                    { appName: APP_NAME },
                  )
                : (() => {
                    if (combinedError || tokenError) {
                      return (
                        <div
                          className={cn(
                            'flex flex-col gap-2',
                            tokenError && 'text-functional-red',
                          )}
                        >
                          <span>
                            {combinedError ||
                              tokenError ||
                              t('There was an error signing you in.')}
                          </span>
                          {errorDescription && !tokenError && (
                            <span className="text-sm text-neutral-gray4">
                              {errorDescription}
                            </span>
                          )}
                        </div>
                      );
                    }

                    if (!loginSuccess) {
                      return t(
                        'Connect with aligned organizations and funders building a new economy together',
                      );
                    }

                    return (
                      <span>
                        {t(
                          'A code was sent to {email}. Type the code below to sign in.',
                          { email },
                        )}
                      </span>
                    );
                  })()}
            </div>
          </section>

          <section className="flex flex-col gap-8">
            {user?.error?.name !== 'AuthRetryableFetchError' &&
              !(login.isError || !!combinedError) && (
                <div className="flex flex-col gap-8">
                  {!loginSuccess && (
                    <>
                      <Button
                        color="secondary"
                        variant="icon"
                        className="w-full text-black"
                        onPress={() => {
                          void handleLogin();
                        }}
                      >
                        <GoogleIcon className="size-4 stroke-none" />
                        {t('Continue with Google')}
                      </Button>

                      <div className="flex w-full items-center justify-center gap-4 text-midGray">
                        <div className="h-px grow bg-current" />
                        <span>{t('or')}</span>
                        <div className="h-px grow bg-current" />
                      </div>
                    </>
                  )}

                  {!loginSuccess && (
                    <div className="flex flex-col">
                      <Form
                        onSubmit={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void login.refetch().then(({ data }) => {
                            if (data) {
                              setLoginSuccess(true);
                            }
                          });
                        }}
                      >
                        <TextField
                          aria-label={t('Email')}
                          label={t('Organization email')}
                          isRequired
                          inputProps={{
                            placeholder: 'admin@yourorganization.org',
                            spellCheck: false,
                          }}
                          autoFocus
                          defaultValue={undefined}
                          isDisabled={
                            login.isFetching || loginSuccess || !!combinedError
                          }
                          value={email}
                          onChange={(val) => {
                            const locEmail = val;

                            setEmailIsValid(
                              emailParser.safeParse(locEmail).success,
                            );
                            setEmail(locEmail);
                          }}
                        />
                      </Form>
                    </div>
                  )}

                  {loginSuccess && (
                    <div className="flex flex-col">
                      <Form
                        onSubmit={async (e) => {
                          if (isValidOtpLength(token)) {
                            e.preventDefault();
                            e.stopPropagation();
                            await handleTokenSubmit();
                          }
                        }}
                      >
                        <TextField
                          aria-label={t('Code')}
                          inputProps={{
                            placeholder: '1234567890',
                            spellCheck: false,
                          }}
                          fieldClassName="h-auto"
                          autoFocus
                          defaultValue={undefined}
                          isDisabled={login.isFetching || !!combinedError}
                          value={token}
                          onChange={(val) => {
                            const locToken = val;

                            setToken(locToken.trim());
                          }}
                        />
                      </Form>
                    </div>
                  )}
                </div>
              )}

            <section className="flex flex-col gap-6">
              {!(login.isError || !!combinedError) ? (
                <>
                  {user?.error?.name === 'AuthRetryableFetchError' ? (
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
                          void login.refetch().then(({ data }) => {
                            if (data) {
                              setLoginSuccess(true);
                            }
                          });
                        } else if (loginSuccess && isValidOtpLength(token)) {
                          void handleTokenSubmit();
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
                  )}
                </>
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

              {user?.error?.name === 'AuthRetryableFetchError' ||
              login.isError ||
              !!combinedError ? null : (
                <div className="flex flex-col items-center justify-center text-center text-xs text-midGray sm:text-sm">
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
                        {t('We will automatically create one for you.')}
                      </span>
                    </>
                  )}
                </div>
              )}
            </section>
          </section>
        </div>
      </div>
    </div>
  );
};

// Supabase OTP length is configurable between 6-10 digits
// https://supabase.com/docs/guides/local-development/cli/config#auth.email.otp_length
function isValidOtpLength(token: string | undefined): boolean {
  if (!token) {
    return false;
  }

  return token.length >= 6 && token.length <= 10;
}

export default LoginPanel;
