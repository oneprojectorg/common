'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { usePhoneLoginFlow } from '@/hooks/usePhoneLoginFlow';
import { trpc } from '@op/api/client';
import { getSafeRedirectPath } from '@op/common/client';
import { APP_NAME, OPURLConfig } from '@op/core';
import { useAuthUser, useMount } from '@op/hooks';
import { Button } from '@op/sense/Button';
import { SocialLinks } from '@op/sense/SocialLinks';
import { createSBBrowserClient } from '@op/supabase/client';
import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import {
  type AuthChannel,
  AuthCodeField,
  AuthCodeStepActions,
  AuthContactFields,
  AuthDivider,
  AuthGoogleButton,
  AuthPanelShell,
  AuthSendCodeButton,
  CodeSentAnnouncement,
  codeSentToLabel,
  isValidOtpLength,
  useAuthPanelStore,
} from './AuthPanel';
import { CommonLogo } from './CommonLogo';

/** Which of the four screens the panel is showing. */
type LoginStep = 'phone-code' | 'phone-number' | 'email-address' | 'email-code';

/**
 * Standard login / signup panel.
 *
 * Shares its contact and code steps with `JoinAccountModal` (AuthPanel);
 * the auth logic is not shared — this panel signs people in through the
 * invite-only gate.
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

  const sentTo = isCodeStep
    ? codeSentToLabel(t, { isPhone, phone: phoneFlow.normalized, email })
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
      setTokenError(error?.message ?? t('auth.verifyCodeError'));
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

  const switchChannel = (next: AuthChannel) => {
    setChannel(next);
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
        return t('auth.waitlistTitle');
      }
      return t('auth.errorTitle');
    }
    if (isCodeStep) {
      return isPhone ? t('auth.checkTextsTitle') : t('auth.checkEmailTitle');
    }
    if (isSignup) {
      return t('auth.signUpHeading', { appName: APP_NAME });
    }
    return (
      <div className="flex flex-col gap-2">
        <span className="font-sans text-base font-normal tracking-normal text-muted-foreground">
          {t('auth.welcomeHeading')}
        </span>
        <span>
          <CommonLogo className="h-8 w-auto" />
        </span>
      </div>
    );
  })();

  const subtitle = (() => {
    if (isConnectionError) {
      return t('auth.offlineError', { appName: APP_NAME });
    }
    if (combinedError) {
      return <span>{combinedError}</span>;
    }
    if (isCodeStep) {
      return sentTo;
    }
    return t('auth.marketingTagline');
  })();

  return (
    <AuthPanelShell title={title} subtitle={subtitle}>
      <CodeSentAnnouncement sentTo={sentTo} />

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
          ) : (
            <AuthContactFields
              smsEnabled={smsLoginEnabled}
              value={activeChannel}
              onValueChange={switchChannel}
              isTriggersDisabled={isBusy}
              email={{
                value: email,
                isDisabled: isBusy,
                onChange: (val) => {
                  setEmailIsValid(emailParser.safeParse(val).success);
                  setEmail(val);
                },
                onSubmit: requestEmailCode,
              }}
              phone={{
                value: phone,
                isDisabled: phoneFlow.isSending,
                onChange: setPhone,
                onSubmit: () => {
                  void phoneFlow.requestCode();
                },
              }}
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
              <AuthCodeStepActions
                // Email leaves an empty field enabled; handleTokenSubmit no-ops instead.
                isVerifyDisabled={
                  isPhone
                    ? !isValidOtpLength(token)
                    : !!token && !isValidOtpLength(token)
                }
                isBusy={isBusy}
                isPhone={isPhone}
                onVerify={verifyCode}
                onResend={resendCode}
                onBack={backToContact}
              />
            </div>
          ) : (
            <AuthSendCodeButton
              isPhone={isPhone}
              isBusy={isBusy}
              isDisabled={
                isBusy || (isPhone ? !phoneFlow.isValid : !emailIsValid)
              }
              onSubmit={() => {
                if (isPhone) {
                  void phoneFlow.requestCode();
                } else {
                  requestEmailCode();
                }
              }}
            />
          )
        ) : (
          <div className="flex flex-col items-center justify-center gap-4">
            <ButtonLink
              href={`${OPURLConfig('APP').ENV_URL}/login`}
              variant="default"
              className="flex w-full items-center justify-center"
            >
              {t('auth.backToHomeAction')}
            </ButtonLink>

            <SocialLinks iconClassName="size-5 stroke-none text-muted-foreground" />
          </div>
        )}

        {!isConnectionError && !isErrorState && (
          <div className="flex flex-col items-center justify-center text-center text-xs text-muted-foreground sm:text-sm">
            {isSignup ? (
              <span>{t('auth.codeDeliveryHint')}</span>
            ) : (
              <>
                <span>{t('auth.noAccountPrompt')}</span>
                <span>{t('auth.noAccountHint')}</span>
              </>
            )}
          </div>
        )}
      </section>
    </AuthPanelShell>
  );
};

export default LoginPanel;
