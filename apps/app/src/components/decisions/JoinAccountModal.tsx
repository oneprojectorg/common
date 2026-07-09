'use client';

import { useClaimAccount } from '@/hooks/useClaimAccount';
import { useUser } from '@/utils/UserProvider';
import { Button } from '@op/ui/Button';
import { Header1 } from '@op/ui/Header';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { Modal } from '@op/ui/Modal';
import { usePathname } from 'next/navigation';
import { useQueryState } from 'nuqs';
import { type ReactNode, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { AuthCodeField, AuthEmailField, isValidOtpLength } from '../AuthPanel';

/**
 * "Join" flow for public decision processes: claims a full account for the
 * current visitor (see useClaimAccount) directly in a modal — email, then OTP,
 * then the promote onboarding at /start. Opened by JoinDecisionButton (the
 * header's replacement for "Log in" on public processes) via `?join=1`.
 *
 * Only meaningful for logged-out and anonymous visitors; a full account never
 * sees the Join button and the modal won't open for one.
 */

export const JoinAccountModal = ({ canJoin }: { canJoin: boolean }) => {
  const { user } = useUser();
  const [join, setJoin] = useQueryState('join');

  const isOpen =
    canJoin && (!user || Boolean(user.isAnonymous)) && join === '1';

  const close = () => {
    void setJoin(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => (open ? null : close())}
      className="sm:max-w-[29rem]"
    >
      <JoinAccountModalContent />
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

const emailParser = z.email();

const JoinAccountModalContent = () => {
  const t = useTranslations();
  const { requestEmailCode, verifyEmailCode, goToOnboarding } =
    useClaimAccount();
  // next/navigation (not the i18n router): the locale prefix must stay — the
  // promote-onboarding redirect and the locale-less /login route both need it.
  const pathname = usePathname();

  const [email, setEmail] = useState('');
  const [emailIsValid, setEmailIsValid] = useState(false);
  const [token, setToken] = useState<string | undefined>();
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

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

    try {
      const result = await requestEmailCode(email);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (!result.needsOtp) {
        goAfterClaim();
        return;
      }
      setOtpSent(true);
    } finally {
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
    } finally {
      setIsSubmitting(false);
    }
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
    <div className="flex flex-col gap-6 p-8 text-center sm:px-12 sm:py-12">
      <div className="flex flex-col gap-2">
        <Header1>
          {otpSent ? t('Email sent!') : t('Claim your account')}
        </Header1>
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

      {error ? <p className="text-sm text-functional-red">{error}</p> : null}

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
              placeholder="your@email.com"
              value={email}
              isDisabled={isSubmitting}
              onChange={(val) => {
                setEmailIsValid(emailParser.safeParse(val).success);
                setEmail(val);
              }}
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
