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
import React, { useCallback, useState } from 'react';
import { z } from 'zod';
import { create } from 'zustand';
import GoogleIcon from '~icons/logos/google-icon.jsx';

import { CommonLogo } from './CommonLogo';
import { EmailCollectionModal } from './EmailCollectionModal';

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
  blueskyHandle: string;
  setBlueskyHandle: (handle: string) => void;
  showBlueskyInput: boolean;
  setShowBlueskyInput: (show: boolean) => void;
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
  blueskyHandle: '',
  setBlueskyHandle: (handle) => set({ blueskyHandle: handle }),
  showBlueskyInput: false,
  setShowBlueskyInput: (show) => set({ showBlueskyInput: show }),
  reset: () =>
    set({
      email: '',
      emailIsValid: false,
      token: undefined,
      tokenError: undefined,
      loginSuccess: false,
      blueskyHandle: '',
      showBlueskyInput: false,
    }),
}));

export const LoginPanel = () => {
  const supabase = createSBBrowserClient();

  const { mounted } = useMount();
  const searchParams = useSearchParams();
  const error = searchParams.get('error');
  const isSignup = searchParams.get('signup');
  const requireEmail = searchParams.get('requireEmail');
  const partialSessionId = searchParams.get('partialSessionId');

  const [isEmailModalOpen, setIsEmailModalOpen] = useState(
    requireEmail === 'true' && !!partialSessionId
  );

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
    blueskyHandle,
    setBlueskyHandle,
    showBlueskyInput,
    setShowBlueskyInput,
  } = useLoginStore();

  const [isBlueskyLoading, setIsBlueskyLoading] = useState(false);

  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/api/auth/callback`,
      },
    });
  };

  const handleBlueskyLogin = async () => {
    if (!blueskyHandle) {
      return;
    }

    setIsBlueskyLoading(true);

    try {
      const response = await fetch('/api/auth/atproto/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: blueskyHandle }),
      });

      const data = await response.json();

      if (data.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      } else {
        setTokenError(data.error || 'Failed to initiate Bluesky login');
        setIsBlueskyLoading(false);
      }
    } catch (error) {
      setTokenError('Failed to connect to Bluesky');
      setIsBlueskyLoading(false);
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

  // TODO: using a tailwind v4 class here "min-w-xs"
  return (
    <>
      {requireEmail === 'true' && partialSessionId && (
        <EmailCollectionModal
          isOpen={isEmailModalOpen}
          partialSessionId={partialSessionId}
          onComplete={() => {
            setIsEmailModalOpen(false);
          }}
          onClose={() => {
            setIsEmailModalOpen(false);
            window.history.replaceState({}, '', '/login');
          }}
        />
      )}

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

                      <Button
                        color="secondary"
                        variant="icon"
                        className="w-full text-black"
                        onPress={() => {
                          setShowBlueskyInput(!showBlueskyInput);
                        }}
                      >
                        <svg className="size-4" viewBox="0 0 568 501" fill="currentColor">
                          <path d="M123.121 33.6637C188.241 82.5526 258.281 181.681 284 234.873C309.719 181.681 379.759 82.5526 444.879 33.6637C491.866 -1.61183 568 -28.9064 568 57.9464C568 75.2916 558.055 203.659 552.222 224.501C531.947 296.954 458.067 315.434 392.347 304.249C507.222 323.8 536.444 388.56 473.333 453.32C353.473 576.312 301.061 422.461 287.631 383.039C285.169 375.812 284.017 372.431 284 375.306C283.983 372.431 282.831 375.812 280.369 383.039C266.939 422.461 214.527 576.312 94.6667 453.32C31.5556 388.56 60.7778 323.8 175.653 304.249C109.933 315.434 36.0535 296.954 15.7778 224.501C9.94525 203.659 0 75.2916 0 57.9464C0 -28.9064 76.1345 -1.61183 123.121 33.6637Z"/>
                        </svg>
                        Continue with Bluesky
                      </Button>

                      {showBlueskyInput && (
                        <div className="flex flex-col gap-2">
                          <TextField
                            aria-label="Bluesky Handle"
                            label="Bluesky handle"
                            inputProps={{
                              placeholder: '@username.bsky.social',
                              spellCheck: false,
                            }}
                            value={blueskyHandle}
                            onChange={(val) => setBlueskyHandle(val)}
                            isDisabled={isBlueskyLoading}
                          />
                          <Button
                            className="w-full"
                            onPress={() => void handleBlueskyLogin()}
                            isDisabled={!blueskyHandle || isBlueskyLoading}
                          >
                            {isBlueskyLoading ? <LoadingSpinner /> : 'Continue'}
                          </Button>
                        </div>
                      )}

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
                          if (token && token.length === 10) {
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
                        (!!token && token.length !== 10)
                      }
                      onPress={async () => {
                        if (!loginSuccess) {
                          void login.refetch().then(({ data }) => {
                            if (data) {
                              setLoginSuccess(true);
                            }
                          });
                        } else if (
                          loginSuccess &&
                          token &&
                          token.length === 10
                        ) {
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
    </>
  );
};

export default LoginPanel;
