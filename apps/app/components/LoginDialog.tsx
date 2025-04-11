/* eslint-disable ts/no-misused-promises */

'use client';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import React, { useCallback } from 'react';
import { z } from 'zod';
import { create } from 'zustand';

import { APP_NAME, OP_EMAIL_HELP, OPURLConfig } from '@op/core';
import { useAuthUser, useMount } from '@op/hooks';
import { createSBBrowserClient } from '@op/supabase/client';
import { trpc } from '@op/trpc/client';
import { Button, ButtonLink } from '@op/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from '@op/ui/Dialog';
import { Form } from '@op/ui/Form';
import { SocialLinks } from '@op/ui/SocialLinks';
import { TextField } from '@op/ui/TextField';
import { cn } from '@op/ui/utils';

import GoogleIcon from '~icons/logos/google-icon.jsx';

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

const LoginDialog = ({
  open = false,
  onOpenChange,
}: {
  open?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}) => {
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

  const emailParser = z.string().email();

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

  return (
    <div
      isOpen={open}
      onOpenChange={(isOpen) => onOpenChange?.(isOpen)}
      className="inset-shadow isolate z-[999999] max-h-full w-auto w-full max-w-md rounded-2xl border border-neutral-200 bg-neutral-100/95 bg-clip-padding text-left align-middle font-sans text-neutral-700 backdrop-blur-lg backdrop-brightness-50 backdrop-saturate-50 entering:duration-500 entering:ease-out entering:animate-in entering:fade-in exiting:duration-500 exiting:ease-in exiting:animate-out exiting:fade-out xs:w-96"
    >
      <Dialog>
        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center gap-2">
            <Image
              src="/op.png"
              alt="OP"
              width={48}
              height={48}
              className="size-4"
            />
            One Project
            <div>
              <span className="border-orange text-orange rounded border p-1 font-mono text-xs">
                {APP_NAME}
              </span>
            </div>
          </div>
          <DialogHeader className="mt-4 font-serif text-xl">
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

                    return 'Welcome';
                  }

                  return 'Check your email!';
                })()}
          </DialogHeader>
        </div>

        <DialogDescription className="text-center">
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
                  return (
                    <span>
                      {isSignup ? 'Sign up' : 'Sign in'} using Google or your
                      email.
                    </span>
                  );
                }

                return (
                  <span>
                    A code was sent to{' '}
                    <span className="text-neutral-400">{email}</span>. Type the
                    code below to sign in.
                  </span>
                );
              })()}
        </DialogDescription>

        {user?.error?.name !== 'AuthRetryableFetchError' &&
          !(login.isError || !!combinedError) && (
            <DialogContent className="flex flex-col gap-4">
              {!loginSuccess && (
                <>
                  <Button
                    className="relative z-0 flex w-full items-center justify-center gap-4 font-normal shadow-md"
                    onPress={() => {
                      void handleLogin();
                    }}
                  >
                    <div className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 opacity-50 blur-xl">
                      <GoogleIcon className="size-8 scale-x-[10]" />
                    </div>
                    <GoogleIcon className="size-[0.9em]" />
                    Continue with Google
                  </Button>

                  <div className="flex w-full items-center justify-center gap-4">
                    <div className="h-px grow rounded-full bg-gradient-to-r from-neutral-700/0 to-neutral-700/100" />
                    <div className="text-neutral-500">or</div>
                    <div className="h-px grow rounded-full bg-gradient-to-l from-neutral-700/0 to-neutral-700/100" />
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
                      inputProps={{
                        placeholder: OP_EMAIL_HELP,
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
                      if (token && token.length === 6) {
                        e.preventDefault();
                        e.stopPropagation();
                        await handleTokenSubmit();
                      }
                    }}
                  >
                    <TextField
                      aria-label="Email"
                      inputProps={{
                        placeholder: '123456',
                        spellCheck: false,
                        className: 'text-center text-4xl',
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
            </DialogContent>
          )}

        <DialogFooter className="mt-4 flex flex-col gap-6">
          {!(login.isError || !!combinedError) ? (
            <>
              {user?.error?.name === 'AuthRetryableFetchError' ? (
                <Button
                  type="button"
                  color="gradient"
                  className="flex w-full items-center justify-center"
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
                  color="gradient"
                  className="flex w-full items-center justify-center"
                  isDisabled={
                    !emailIsValid ||
                    login.isFetching ||
                    (!!token && token.length !== 6)
                  }
                  onPress={async () => {
                    if (!loginSuccess) {
                      void login.refetch().then(({ data }) => {
                        if (data) {
                          setLoginSuccess(true);
                        }
                      });
                    } else if (loginSuccess && token && token.length === 6) {
                      void handleTokenSubmit();
                    }
                  }}
                >
                  {login.isFetching ? (
                    <div className="m-0.5 aspect-square w-5 animate-spin rounded-full border-2 border-b-0 border-neutral-500" />
                  ) : loginSuccess ? (
                    isSignup ? (
                      'Sign up'
                    ) : (
                      'Login'
                    )
                  ) : (
                    'Continue'
                  )}
                </Button>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="h-px w-full bg-gradient-to-r from-neutral-700/0 via-neutral-700/100 to-neutral-700/0" />

              <ButtonLink
                href={`${OPURLConfig('APP').ENV_URL}`}
                color="gradient"
                className="flex w-full items-center justify-center"
              >
                Back to home
              </ButtonLink>

              <div className="h-px w-full bg-gradient-to-r from-neutral-700/0 via-neutral-700/100 to-neutral-700/0" />

              <SocialLinks iconClassName="size-5 text-neutral-500" />
            </div>
          )}

          {user?.error?.name === 'AuthRetryableFetchError' ||
          login.isError ||
          !!combinedError ? null : (
            <>
              {isSignup ? (
                <div className="flex flex-col items-center justify-center px-4 text-center text-sm text-neutral-500">
                  <span>
                    You'll receive a code to confirm your account. Can't find
                    it? Check your spam folder.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 text-sm text-neutral-500">
                  <span>Don&apos;t have an account?</span>
                  <span>We will automatically create one for you.</span>
                </div>
              )}
            </>
          )}
        </DialogFooter>
      </Dialog>
    </div>
  );
};

export default LoginDialog;
