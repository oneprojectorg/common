'use client';

import { trpc } from '@op/api/client';
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
import { z } from 'zod';
import { create } from 'zustand';

import { CommonLogo } from './CommonLogo';

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 256 262"
    className={className}
  >
    <path
      fill="#4285F4"
      d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
    />
    <path
      fill="#34A853"
      d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
    />
    <path
      fill="#FBBC05"
      d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
    />
    <path
      fill="#EB4335"
      d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
    />
  </svg>
);

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

  const { mounted } = useMount();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const isSignup = searchParams.get('signup');

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
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/api/auth/callback`,
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
      window.location.reload();
    } else {
      setTokenError(error?.message ?? 'Failed to verify code');
    }
  }, [email, token]);

  if (!mounted) return null;

  // TODO: using a tailwind v4 class here "min-w-xs"
  return (
    <div className="flex items-center justify-center sm:block">
      <div className="min-w-xs z-[999999] max-h-full w-auto rounded-md border-offWhite bg-white bg-clip-padding px-4 py-8 font-sans text-neutral-700 xs:w-96 sm:border-0">
        <div className="flex flex-col gap-12 sm:gap-8">
          <section className="flex flex-col items-center justify-center gap-2 sm:gap-4">
            <Header1 className="text-center">
              {user?.error?.name === 'AuthRetryableFetchError'
                ? 'Connection Issue'
                : (() => {
                    if (login.isError || error || tokenError) {
                      if (
                        combinedError?.includes('invite') ||
                        combinedError?.includes('waitlist')
                      ) {
                        return 'Stay tuned!';
                      }

                      return 'Oops!';
                    }

                    if (!loginSuccess) {
                      if (isSignup) {
                        return `Sign up to ${APP_NAME}`;
                      }

                      return (
                        <div className="flex flex-col gap-2">
                          <span className="sm:text-base">Welcome to</span>
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
                          Email sent!
                        </span>
                      </div>
                    );
                  })()}
            </Header1>

            <div className="px-4 text-center text-sm leading-[130%] text-neutral-gray4 sm:text-base">
              {user?.error?.name === 'AuthRetryableFetchError'
                ? `${APP_NAME} can\`t connect to the internet. Please check your internet connection and try again.`
                : (() => {
                    if (combinedError || tokenError) {
                      return (
                        <span className={cn(tokenError && 'text-red-500')}>
                          {combinedError ||
                            tokenError ||
                            'There was an error signing you in.'}
                        </span>
                      );
                    }

                    if (!loginSuccess) {
                      return 'Connect with aligned organizations and funders building a new economy together';
                    }

                    return (
                      <span>
                        A code was sent to <span>{email}</span>. Type the code
                        below to sign in.
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
                        <GoogleIcon className="size-4" />
                        Continue with Google
                      </Button>

                      <div className="flex w-full items-center justify-center gap-4 text-midGray">
                        <div className="h-px grow bg-current" />
                        <span>or</span>
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
                          aria-label="Email"
                          label="Organization email"
                          isRequired
                          inputProps={{
                            placeholder: 'admin@yourorganization.org',
                            spellCheck: false,
                          }}
                          // eslint-disable-next-line jsx-a11y/no-autofocus
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
                          aria-label="Code"
                          inputProps={{
                            placeholder: '1234567890',
                            spellCheck: false,
                          }}
                          fieldClassName="h-auto"
                          // eslint-disable-next-line jsx-a11y/no-autofocus
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
                        <div className="m-0.5 aspect-square w-5 animate-spin rounded-full border-2 border-b-0 border-neutral-500" />
                      ) : (
                        'Try again'
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
                          'Sign up'
                        ) : (
                          'Login'
                        )
                      ) : (
                        'Sign in'
                      )}
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center gap-4">
                  <ButtonLink
                    href={`${OPURLConfig('APP').ENV_URL}`}
                    color="gradient"
                    className="flex w-full items-center justify-center"
                  >
                    Back to home
                  </ButtonLink>

                  <SocialLinks iconClassName="size-5 text-neutral-500" />
                </div>
              )}

              {user?.error?.name === 'AuthRetryableFetchError' ||
              login.isError ||
              !!combinedError ? null : (
                <div className="flex flex-col items-center justify-center text-center text-xs text-midGray sm:text-sm">
                  {isSignup ? (
                    <span>
                      You'll receive a code to confirm your account. Can't find
                      it? Check your spam folder.
                    </span>
                  ) : (
                    <>
                      <span>Don&apos;t have an account?</span>
                      <span>We will automatically create one for you.</span>
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
