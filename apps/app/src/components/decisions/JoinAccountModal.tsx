'use client';

import {
  getClaimEmailErrorMessage,
  getClaimPhoneErrorMessage,
  getOnboardingPath,
  goToOnboarding,
  useClaimAccount,
} from '@/hooks/useClaimAccount';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { useUser } from '@/utils/UserProvider';
import type { CommonUser } from '@op/api/encoders';
import { normalizePhoneNumber, phoneNumberSchema } from '@op/common/client';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { createSBBrowserClient } from '@op/supabase/client';
import { usePathname } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { type ReactNode, Suspense, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  type AuthChannel,
  AuthCodeField,
  AuthCodeStepActions,
  AuthContactFields,
  AuthDivider,
  AuthGoogleButton,
  AuthSendCodeButton,
  CodeSentAnnouncement,
  codeSentToLabel,
  isValidOtpLength,
} from '../AuthPanel';
import { HeaderUserMenu } from '../SiteHeader';
import { isValidEmail } from './emailUtils';

/**
 * "Join" flow for public decision processes: claims a full account for the
 * current visitor (see useClaimAccount) directly in a modal — email, then OTP,
 * then the promote onboarding at /start. Opened by JoinDecisionButton (the
 * header's replacement for "Log in" on public processes) via `?join=1`.
 *
 * Mounted only on public processes (the decision-view layout gates on the
 * viewer's submitProposals access) and only meaningful for logged-out and
 * anonymous visitors; a full account never sees the Join button and the modal
 * won't open for one.
 */

/**
 * Who may claim: logged-out visitors and anonymous accounts. NOT the same as
 * `!userCanInteract` — a full account without a currentProfile must see the
 * user menu, not Join.
 */
export const isJoinEligible = (user: CommonUser | null | undefined): boolean =>
  !user || user.isAnonymous;

export const JoinAccountModal = () => {
  const { user } = useUser();
  const [join, setJoin] = useQueryState('join');

  const isOpen = isJoinEligible(user) && join === '1';

  const close = () => {
    void setJoin(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (open ? null : close())}>
      <DialogContent className="sm:max-w-128">
        <JoinAccountModalContent />
      </DialogContent>
    </Dialog>
  );
};

/** Header button that opens the modal. Reads/writes `?join` via nuqs, so any
 * mount point must sit under a Suspense boundary (useSearchParams). */
export const JoinDecisionButton = ({
  ariaDescribedBy,
}: {
  /** Id of an element giving the bare "Join" label its context (a11y). */
  ariaDescribedBy?: string;
}) => {
  const t = useTranslations();
  const [, setJoin] = useQueryState('join');

  return (
    <Button
      aria-describedby={ariaDescribedBy}
      onClick={() => {
        void setJoin('1');
      }}
    >
      {t('Join')}
    </Button>
  );
};

/**
 * Suspense fallback for JoinDecisionButton in the prerendered shell: a plain
 * link so the button works even before hydration (nuqs takes over after).
 */
export const JoinDecisionButtonFallback = () => {
  const t = useTranslations();

  // Same as ButtonLink: it renders an anchor, so tell base-ui it isn't a native
  // button and keep link semantics rather than its `role="button"`.
  return (
    <Button nativeButton={false} role={undefined} render={<a href="?join=1" />}>
      {t('Join')}
    </Button>
  );
};

/**
 * Header account control: Join (account claim) for join-eligible visitors on
 * public processes, the avatar menu / Log in otherwise. Owns the eligibility
 * check and the Suspense treatment JoinDecisionButton's nuqs read requires, so
 * every header renders the same behavior.
 */
export const JoinOrUserMenu = ({
  canJoin,
  userMenuClassName,
}: {
  canJoin: boolean;
  /** Passed to HeaderUserMenu only — lets headers keep the avatar sm-gated
   * while Join stays visible at all widths. */
  userMenuClassName?: string;
}) => {
  const { user } = useUser();

  if (canJoin && isJoinEligible(user)) {
    return (
      <Suspense fallback={<JoinDecisionButtonFallback />}>
        <JoinDecisionButton />
      </Suspense>
    );
  }
  return <HeaderUserMenu className={userMenuClassName} />;
};

const JoinAccountModalContent = () => {
  const t = useTranslations();
  const supabase = createSBBrowserClient();
  const {
    requestEmailCode,
    verifyEmailCode,
    requestPhoneCode,
    verifyPhoneCode,
  } = useClaimAccount();
  // Same flag the login screen gates its phone channel on, so the two agree
  // about whether SMS exists at all.
  const smsEnabled = useFeatureFlag('sms-login') ?? false;
  // next/navigation (not the i18n router): the locale prefix must stay — the
  // promote-onboarding redirect and the locale-less /login route both need it.
  const pathname = usePathname();
  // Shares the `join` key with the parent JoinAccountModal's own instance, so
  // clearing it here closes the dialog the same way the dismiss X does.
  const [, setJoin] = useQueryState('join');
  const close = () => {
    void setJoin(null);
  };

  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [channel, setChannel] = useState<'email' | 'phone'>('email');
  const [token, setToken] = useState<string | undefined>();
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // With the flag off there is no phone channel to be on, even if a previous
  // render put us there.
  const activeChannel = smsEnabled ? channel : 'email';
  const isPhone = activeChannel === 'phone';

  const emailIsValid = isValidEmail(email);
  // People type `(415) 555-0132`. Validate what they meant, and send that.
  const phoneIsValid = phoneNumberSchema.safeParse(
    normalizePhoneNumber(phone),
  ).success;
  const contactIsValid = isPhone ? phoneIsValid : emailIsValid;

  // Return to this decision page after onboarding. Query params are dropped
  // deliberately — `join=1` must not re-open the modal on the way back.
  const goAfterClaim = () => {
    goToOnboarding(pathname);
  };

  // Google is a redirect flow, not an in-page OTP exchange, so it can't call
  // goAfterClaim itself — the destination has to travel as the callback's own
  // `redirect` param.
  //
  // KNOWN GAP: unlike requestEmailCode/requestPhoneCode (see useClaimAccount's
  // module doc), this goes through the standard /api/auth/callback, which
  // calls account.login and enforces the invite-only allow-list. A public,
  // uninvited visitor who picks "Continue with Google" here will be rejected
  // and their freshly-created account deleted — the exact gate the claim flow
  // exists to bypass. Left as-is per product decision; needs a claim-flow
  // equivalent (linkIdentity) before this is correct for public processes.
  const joinWithGoogle = async () => {
    const callbackUrl = new URL('/api/auth/callback', window.location.origin);
    callbackUrl.searchParams.set('redirect', getOnboardingPath(pathname));
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl.toString() },
    });
  };

  const submitContact = async () => {
    if (isSubmitting || !contactIsValid) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    // Deliberately left submitting through the success-navigation path so the
    // form can't be re-submitted while window.location is unloading the page.
    try {
      const result = isPhone
        ? await requestPhoneCode(phone, { mintAnonSession: true })
        : await requestEmailCode(email, { mintAnonSession: true });
      if (!result.ok) {
        setError(
          isPhone
            ? getClaimPhoneErrorMessage(result, t)
            : getClaimEmailErrorMessage(result, t),
        );
        setIsSubmitting(false);
        return;
      }
      if (!result.needsOtp) {
        goAfterClaim();
        return;
      }
      setOtpSent(true);
      setIsSubmitting(false);
    } catch {
      setError(t("That didn't work"));
      setIsSubmitting(false);
    }
  };

  const submitToken = async () => {
    if (!token || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    try {
      const result = isPhone
        ? await verifyPhoneCode({ phone, token })
        : await verifyEmailCode({ email, token });
      if (result.ok) {
        goAfterClaim();
        return;
      }
      setError(result.message ?? t('Failed to verify code'));
    } catch {
      setError(t('Failed to verify code'));
    }
    setIsSubmitting(false);
  };

  const goBack = () => {
    setOtpSent(false);
    setToken(undefined);
    setError(undefined);
  };

  const resendCode = () => {
    setToken(undefined);
    void submitContact();
  };

  const switchChannel = (next: AuthChannel) => {
    setChannel(next);
    setError(undefined);
    setEmail('');
    setPhone('');
  };

  // Native anchor: /login is outside the [locale] tree, so a RAC link 404s at
  // /en/login (same as HeaderUserMenu).
  const loginHref = `/login?redirect=${encodeURIComponent(pathname)}`;

  const sentTo = otpSent
    ? codeSentToLabel(t, { isPhone, phone: normalizePhoneNumber(phone), email })
    : undefined;

  return (
    <>
      {/* DialogContent renders the dismiss X; DialogTitle names the dialog. */}
      <DialogHeader>
        <DialogTitle className="text-center">
          {otpSent
            ? isPhone
              ? t('Check your texts')
              : t('Check your email')
            : t('Add your voice to this idea')}
        </DialogTitle>
        <DialogDescription className="text-center">
          {sentTo ??
            t(
              'Liking shows others which ideas matter most. Sign up in seconds and your like will be counted.',
            )}
        </DialogDescription>
      </DialogHeader>

      <CodeSentAnnouncement sentTo={sentTo} />

      <div className="flex flex-col gap-4 px-6 py-4">
        {/* role="alert" so async claim errors are announced while focus stays on
          the submit button. */}
        {error ? (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        ) : null}

        {otpSent ? (
          <AuthCodeField
            value={token}
            isDisabled={isSubmitting}
            onChange={setToken}
            onSubmit={submitToken}
          />
        ) : (
          <>
            <AuthGoogleButton
              onPress={() => {
                void joinWithGoogle();
              }}
            />
            <AuthDivider />
            <AuthContactFields
              smsEnabled={smsEnabled}
              value={activeChannel}
              onValueChange={switchChannel}
              email={{
                value: email,
                isDisabled: isSubmitting,
                onChange: setEmail,
                onSubmit: () => {
                  void submitContact();
                },
              }}
              phone={{
                value: phone,
                isDisabled: isSubmitting,
                onChange: setPhone,
                onSubmit: () => {
                  void submitContact();
                },
              }}
              isTriggersDisabled={isSubmitting}
            />
            <p className="text-muted-foreground">
              {t.rich('Already have an account? <login>Log in</login>', {
                login: (chunks: ReactNode) => (
                  <a href={loginHref} className="underline">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </>
        )}
      </div>

      <DialogFooter className="flex-col sm:flex-col">
        {otpSent ? (
          <AuthCodeStepActions
            isVerifyDisabled={!isValidOtpLength(token)}
            isBusy={isSubmitting}
            isPhone={isPhone}
            onVerify={() => {
              void submitToken();
            }}
            onResend={resendCode}
            onBack={goBack}
          />
        ) : (
          <>
            <AuthSendCodeButton
              isPhone={isPhone}
              isBusy={isSubmitting}
              isDisabled={isSubmitting || !contactIsValid}
              onSubmit={() => {
                void submitContact();
              }}
            />
            <Button variant="link" onClick={close}>
              {t('Browse proposals for now')}
            </Button>
          </>
        )}
      </DialogFooter>
    </>
  );
};
