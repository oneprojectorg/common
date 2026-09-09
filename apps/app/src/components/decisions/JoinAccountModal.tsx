'use client';

import {
  getClaimEmailErrorMessage,
  getClaimPhoneErrorMessage,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { usePathname } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { type ReactNode, Suspense, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  AuthCodeField,
  AuthEmailField,
  AuthPhoneField,
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

  // Switching channel abandons whatever was typed in the other one, so a
  // half-entered address can't be submitted against the wrong endpoint.
  const switchChannel = () => {
    setChannel(isPhone ? 'email' : 'phone');
    setError(undefined);
    setEmail('');
    setPhone('');
  };

  // Native anchor: /login is outside the [locale] tree, so a RAC link 404s at
  // /en/login (same as HeaderUserMenu).
  const loginHref = `/login?redirect=${encodeURIComponent(pathname)}`;

  return (
    <>
      {/* DialogContent renders the dismiss X; DialogTitle names the dialog. */}
      <DialogHeader>
        <DialogTitle>
          {otpSent
            ? isPhone
              ? t('Code sent!')
              : t('Email sent!')
            : t('Claim your account')}
        </DialogTitle>
        <DialogDescription>
          {otpSent
            ? isPhone
              ? t(
                  'A code was sent to {phone}. Type the code below to create your profile.',
                  { phone: normalizePhoneNumber(phone) },
                )
              : t(
                  'A code was sent to {email}. Type the code below to create your profile.',
                  { email },
                )
            : t(
                'Join Common to like, comment on, and follow any idea — and to edit and get updates about your own submissions.',
              )}
        </DialogDescription>
      </DialogHeader>

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
            {smsEnabled ? (
              <Tabs
                value={activeChannel}
                onValueChange={(next) => {
                  if (next !== activeChannel) {
                    switchChannel();
                  }
                }}
              >
                <span id="join-channel-label" className="text-label">
                  {t('Sign up with')}
                </span>
                {/* TabsList is `w-fit`; the design splits the full width. */}
                <TabsList
                  className="w-full"
                  aria-labelledby="join-channel-label"
                >
                  <TabsTrigger
                    value="email"
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {t('Email')}
                  </TabsTrigger>
                  <TabsTrigger
                    value="phone"
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {t('Phone number')}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="email">
                  <AuthEmailField
                    label={t('Email')}
                    // The design says "We'll email a link"; we send a
                    // six-digit code, so the copy says code.
                    description={t(
                      "We'll email you a code to confirm it's yours.",
                    )}
                    // Example-email placeholders are deliberately untranslated.
                    placeholder="name@example.com"
                    value={email}
                    isDisabled={isSubmitting}
                    onChange={setEmail}
                    onSubmit={() => {
                      void submitContact();
                    }}
                  />
                </TabsContent>
                <TabsContent value="phone">
                  <AuthPhoneField
                    label={t('Phone number')}
                    description={t(
                      'We text you a code. Standard message and data rates may apply.',
                    )}
                    value={phone}
                    isDisabled={isSubmitting}
                    onChange={setPhone}
                    onSubmit={() => {
                      void submitContact();
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
                isDisabled={isSubmitting}
                onChange={setEmail}
                onSubmit={() => {
                  void submitContact();
                }}
              />
            )}
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
          <>
            <Button
              className="w-full"
              loading={isSubmitting}
              disabled={isSubmitting || !isValidOtpLength(token)}
              onClick={() => {
                void submitToken();
              }}
            >
              {t('Create profile')}
            </Button>
            <Button variant="outline" className="w-full" onClick={goBack}>
              {t('Go back')}
            </Button>
          </>
        ) : (
          <Button
            className="w-full"
            loading={isSubmitting}
            disabled={isSubmitting || !contactIsValid}
            onClick={() => {
              void submitContact();
            }}
          >
            {isPhone ? t('Text me a code') : t('Email me a code')}
          </Button>
        )}
      </DialogFooter>
    </>
  );
};
