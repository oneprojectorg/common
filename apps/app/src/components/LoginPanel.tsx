'use client';

import { usePhoneLogin } from '@/hooks/usePhoneLogin';
import { trpc } from '@op/api/client';
import {
  getSafeRedirectPath,
  normalizePhoneNumber,
  phoneNumberSchema,
} from '@op/common/client';
import { APP_NAME, OPURLConfig } from '@op/core';
import { useAuthUser, useMount } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { SocialLinks } from '@op/sense/SocialLinks';
import { Spinner } from '@op/sense/Spinner';
import { CheckIcon } from '@op/sense/icons';
import { cn } from '@op/sense/lib/utils';
import { createSBBrowserClient } from '@op/supabase/client';
import { useSearchParams } from 'next/navigation';
import React, { useCallback, useState } from 'react';
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
    setPhoneCodeSent,
  } = useAuthPanelStore();

  // Only the error stays local. It describes the last attempt, and a stale one
  // after a reload would explain a failure the visitor never saw.
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const phoneLogin = usePhoneLogin();

  // The submit button below is shared by both channels, so each one has to
  // say when it is ready. The server re-validates with this same schema.
  // People type `(818) 212-4554`. Validate and send what they meant.
  const normalizedPhone = normalizePhoneNumber(phone);
  const phoneIsValid = phoneNumberSchema.safeParse(normalizedPhone).success;
  const phoneBusy = phoneLogin.isSending || phoneLogin.isVerifying;

  /** Lands the visitor wherever the email flow would have landed them. */
  const finishSignIn = useCallback(() => {
    if (redirectParam !== null) {
      window.location.href = redirectParam;
    } else {
      window.location.reload();
    }
  }, [redirectParam]);

  const requestPhoneCode = useCallback(async () => {
    setPhoneError(undefined);
    const result = await phoneLogin.requestCode(normalizedPhone);
    if (result.ok) {
      setPhoneCodeSent(true);
      return;
    }
    setPhoneError(result.message ?? t('We could not send a code.'));
  }, [normalizedPhone, phoneLogin, t]);

  /**
   * Asks Twilio for another code.
   *
   * Twilio returns the same code when the current one is still valid, and a
   * new one once it expired. The label says "again" rather than "new" so it is
   * true in both cases.
   */
  const resendPhoneCode = useCallback(async () => {
    setToken(undefined);
    setPhoneError(undefined);
    await requestPhoneCode();
  }, [requestPhoneCode, setToken]);

  /** Returns to the number field, so a wrong number is correctable. */
  const changePhoneNumber = useCallback(() => {
    setPhoneCodeSent(false);
    setToken(undefined);
    setPhoneError(undefined);
  }, [setPhoneCodeSent, setToken]);

  const submitPhoneCode = useCallback(async () => {
    setPhoneError(undefined);
    const result = await phoneLogin.verifyCode({
      phone: normalizedPhone,
      code: token ?? '',
    });
    if (result.ok) {
      finishSignIn();
      return;
    }
    // An expired verification and a wrong code need opposite instructions.
    setPhoneError(
      result.expired
        ? t('That code expired. Request a new one.')
        : t('That code was wrong. Try again.'),
    );
  }, [normalizedPhone, token, phoneLogin, finishSignIn, t]);

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

          {phoneCodeSent ? (
            <div className="flex flex-col gap-4">
              <AuthCodeField
                value={token}
                isDisabled={phoneLogin.isVerifying}
                onChange={setToken}
                onSubmit={submitPhoneCode}
              />
              {phoneError && (
                <span aria-live="polite" className="text-destructive">
                  {phoneError}
                </span>
              )}
              <div className="flex flex-col gap-2">
                <Button
                  variant="link"
                  disabled={phoneBusy}
                  onClick={resendPhoneCode}
                >
                  {t('Send the code again')}
                </Button>
                <Button
                  variant="link"
                  disabled={phoneBusy}
                  onClick={changePhoneNumber}
                >
                  {t('Use a different number')}
                </Button>
              </div>
            </div>
          ) : channel === 'phone' ? (
            <div className="flex flex-col gap-4">
              <AuthPhoneField
                label={t('Phone number')}
                description={t(
                  'We text you a code. Standard message and data rates may apply.',
                )}
                value={phone}
                isDisabled={phoneLogin.isSending}
                onChange={setPhone}
                onSubmit={requestPhoneCode}
              />
              {phoneError && (
                <span aria-live="polite" className="text-destructive">
                  {phoneError}
                </span>
              )}
              <Button
                variant="link"
                onClick={() => {
                  setPhoneError(undefined);
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
              <Button variant="link" onClick={() => setChannel('phone')}>
                {t('Use a phone number instead')}
              </Button>
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
              disabled={
                channel === 'phone'
                  ? phoneBusy ||
                    (phoneCodeSent ? !isValidOtpLength(token) : !phoneIsValid)
                  : !emailIsValid ||
                    login.isFetching ||
                    (!!token && !isValidOtpLength(token))
              }
              onClick={async () => {
                if (channel === 'phone') {
                  if (phoneCodeSent) {
                    await submitPhoneCode();
                  } else {
                    await requestPhoneCode();
                  }
                  return;
                }
                if (!loginSuccess) {
                  requestEmailCode();
                } else if (loginSuccess && isValidOtpLength(token)) {
                  await handleTokenSubmit();
                }
              }}
            >
              {login.isFetching || phoneBusy ? (
                <Spinner className="size-6" />
              ) : loginSuccess || (channel === 'phone' && phoneCodeSent) ? (
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
