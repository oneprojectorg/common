'use client';

import {
  getClaimEmailErrorMessage,
  goToOnboarding,
  useClaimAccount,
} from '@/hooks/useClaimAccount';
import { useUser } from '@/utils/UserProvider';
import { headingClasses } from '@op/styles/constants';
import { Button, ButtonLink } from '@op/ui/Button';
import { IconButton } from '@op/ui/IconButton';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal } from '@op/ui/Modal';
import { usePathname } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { type ReactNode, useState } from 'react';
import { Heading } from 'react-aria-components';
import { LuX } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { AuthCodeField, AuthEmailField, isValidOtpLength } from '../AuthPanel';
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

export const JoinAccountModal = () => {
  const { user } = useUser();
  const [join, setJoin] = useQueryState('join');

  const isOpen = (!user || user.isAnonymous) && join === '1';

  const close = () => {
    void setJoin(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => (open ? null : close())}
      isDismissable
      className="sm:max-w-[29rem]"
    >
      <JoinAccountModalContent onClose={close} />
    </Modal>
  );
};

/** Header button that opens the modal. Reads/writes `?join` via nuqs, so any
 * mount point must sit under a Suspense boundary (useSearchParams). */
export const JoinDecisionButton = ({ className }: { className?: string }) => {
  const t = useTranslations();
  const [, setJoin] = useQueryState('join');

  return (
    <Button
      color="primary"
      size="small"
      className={className}
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

const JoinAccountModalContent = ({ onClose }: { onClose: () => void }) => {
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
    <div className="relative flex flex-col gap-6 p-8 text-center sm:px-12 sm:py-12">
      <IconButton
        size="small"
        aria-label={t('Close')}
        onPress={onClose}
        className="absolute end-4 top-4"
      >
        <LuX className="size-5" aria-hidden />
      </IconButton>

      <div className="flex flex-col gap-2">
        {/* RAC Heading wires the dialog's accessible name (aria-labelledby);
            level 2 avoids a second h1 on the page. */}
        <Heading slot="title" level={2} className={headingClasses.h2}>
          {otpSent ? t('Email sent!') : t('Claim your account')}
        </Heading>
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
      </div>

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
            className="flex w-full items-center justify-center"
            isDisabled={isSubmitting || !isValidOtpLength(token)}
            onPress={() => {
              void submitToken();
            }}
          >
            {isSubmitting ? <LoadingSpinner /> : t('Create profile')}
          </Button>
          <Button
            color="secondary"
            className="flex w-full items-center justify-center"
            onPress={goBack}
          >
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
            className="flex w-full items-center justify-center"
            isDisabled={isSubmitting || !emailIsValid}
            onPress={() => {
              void submitEmail();
            }}
          >
            {isSubmitting ? <LoadingSpinner /> : t('Join')}
          </Button>
          <p className="text-sm text-neutral-charcoal">
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
    </div>
  );
};
