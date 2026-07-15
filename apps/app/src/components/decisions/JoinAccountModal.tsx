'use client';

import {
  getClaimEmailErrorMessage,
  goToOnboarding,
  useClaimAccount,
} from '@/hooks/useClaimAccount';
import { useUser } from '@/utils/UserProvider';
import type { CommonUser } from '@op/api/encoders';
import { Button, ButtonLink } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal, ModalBody, ModalHeader } from '@op/ui/Modal';
import { usePathname } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { type ReactNode, Suspense, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { AuthCodeField, AuthEmailField, isValidOtpLength } from '../AuthPanel';
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
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => (open ? null : close())}
      isDismissable
      surface="flat"
      className="sm:max-w-[29rem]"
    >
      <JoinAccountModalContent />
    </Modal>
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
      color="primary"
      size="small"
      aria-describedby={ariaDescribedBy}
      onPress={() => {
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

  return (
    <ButtonLink href="?join=1" color="primary" size="small">
      {t('Join')}
    </ButtonLink>
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
  const { requestEmailCode, verifyEmailCode } = useClaimAccount();
  // next/navigation (not the i18n router): the locale prefix must stay — the
  // promote-onboarding redirect and the locale-less /login route both need it.
  const pathname = usePathname();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | undefined>();
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const emailIsValid = isValidEmail(email);

  // Return to this decision page after onboarding. Query params are dropped
  // deliberately — `join=1` must not re-open the modal on the way back.
  const goAfterClaim = () => {
    goToOnboarding(pathname);
  };

  const submitEmail = async () => {
    if (isSubmitting || !emailIsValid) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    // Deliberately left submitting through the success-navigation path so the
    // form can't be re-submitted while window.location is unloading the page.
    try {
      const result = await requestEmailCode(email, { mintAnonSession: true });
      if (!result.ok) {
        setError(getClaimEmailErrorMessage(result, t));
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
      const result = await verifyEmailCode({ email, token });
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

  // Native anchor: /login is outside the [locale] tree, so a RAC link 404s at
  // /en/login (same as HeaderUserMenu).
  const loginHref = `/login?redirect=${encodeURIComponent(pathname)}`;

  return (
    <>
      {/* ModalHeader renders the dismiss X (Modal's isDismissable) and a
          slot="title" heading that names the dialog. pt compensates for the
          flat surface's built-in pt-6 to hit p-8 / sm:pt-12 overall. */}
      <ModalHeader className="pt-2 text-title-lg text-neutral-black sm:pt-6 sm:text-title-lg">
        {otpSent ? t('Email sent!') : t('Claim your account')}
      </ModalHeader>
      <ModalBody className="gap-6 px-8 pt-2 pb-8 text-center sm:px-12 sm:pb-12">
        <p className="text-base text-neutral-charcoal">
          {otpSent
            ? t(
                'A code was sent to {email}. Type the code below to create your profile.',
                { email },
              )
            : t(
                'Join Common to like, comment on, and follow any idea — and to edit and get updates about your own submissions.',
              )}
        </p>

        {/* role="alert" so async claim errors are announced while focus stays on
          the submit button. */}
        {error ? (
          <p role="alert" className="text-sm text-functional-red">
            {error}
          </p>
        ) : null}

        {otpSent ? (
          <div className="flex flex-col gap-3 text-start">
            <AuthCodeField
              value={token}
              isDisabled={isSubmitting}
              onChange={setToken}
              onSubmit={submitToken}
            />
            <Button
              className="w-full"
              isDisabled={isSubmitting || !isValidOtpLength(token)}
              onPress={() => {
                void submitToken();
              }}
            >
              {isSubmitting ? <LoadingSpinner /> : t('Create profile')}
            </Button>
            <Button color="secondary" className="w-full" onPress={goBack}>
              {t('Go back')}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-start">
              <AuthEmailField
                label={t('Email')}
                // Example-email placeholders are deliberately untranslated.
                placeholder="your@email.com"
                value={email}
                isDisabled={isSubmitting}
                onChange={setEmail}
                onSubmit={() => {
                  void submitEmail();
                }}
              />
            </div>
            <Button
              className="w-full"
              isDisabled={isSubmitting || !emailIsValid}
              onPress={() => {
                void submitEmail();
              }}
            >
              {isSubmitting ? <LoadingSpinner /> : t('Join')}
            </Button>
            <p className="text-neutral-charcoal">
              {t.rich('Already have an account? <login>Log in</login>', {
                login: (chunks: ReactNode) => (
                  <a href={loginHref} className="text-primary-teal underline">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          </div>
        )}
      </ModalBody>
    </>
  );
};
