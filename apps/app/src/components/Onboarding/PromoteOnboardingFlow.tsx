'use client';

import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import { isSafeRedirectPath } from '@op/common/client';
import { logger } from '@op/logging/client';
import { toast } from '@op/sense/Toast';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { StepperProgressIndicator } from '@op/ui/Stepper';
import { useSearchParams } from 'next/navigation';
import React, { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import {
  MultiStepForm,
  ProgressComponentProps,
  StepProps,
} from '../MultiStepForm';
import { Portal } from '../Portal';
import {
  PersonalDetailsForm,
  validator as PersonalDetailsFormValidator,
} from './PersonalDetailsForm';
import { ToSAcceptanceScreen } from './ToSAcceptanceScreen';
import { useOnboardingFormStore } from './useOnboardingFormStore';

// The ToS step collects no form values of its own.
const ToSStepValidator = z.object({});

const ProgressInPortal = (props: ProgressComponentProps) => (
  <Portal id="top-slot">
    <StepperProgressIndicator {...props} />
  </Portal>
);

/**
 * Onboarding for an anonymous visitor who just upgraded (see LinkAccountPanel /
 * PromoteAccountModal), reached at `/start?promote=1`. Skips org joining:
 * personal details, accept ToS, then hard-navigate back to the decision with a
 * fresh cache.
 */
export const PromoteOnboardingFlow = ({
  hasHydrated,
}: {
  hasHydrated: boolean;
}) => {
  const t = useTranslations();
  const isOnline = useConnectionStatus();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { personalDetails } = useOnboardingFormStore();
  const trpcUtils = trpc.useUtils();
  const completeOnboarding = trpc.account.completeOnboarding.useMutation();

  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  // No fallback is safe for a non-member; the `redirect` back to their public
  // origin page is the only real return path.
  const promoteRedirect = isSafeRedirectPath(redirectParam)
    ? redirectParam
    : '/';

  const getStepValues = useCallback(() => {
    return [personalDetails, {}];
  }, [personalDetails]);

  const handleComplete = useCallback(async () => {
    if (!isOnline) {
      toast.error(t('No connection'), {
        description: t('Please check your internet connection and try again.'),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await completeOnboarding.mutateAsync({ tos: true, privacy: true });
      await trpcUtils.account.getMyAccount.invalidate();
      if (!isSafeRedirectPath(redirectParam)) {
        // `/` sends a non-member into the walled garden (403) — track how often
        // onboarding dead-ends here.
        logger.warn(
          'Promote onboarding finished without a safe redirect; landing may be gated',
          { redirectParam },
        );
      }
      window.location.assign(promoteRedirect);
    } catch (err) {
      setIsSubmitting(false);
      const errorInfo = analyzeError(err);
      toast.error(
        errorInfo.isConnectionError
          ? t('Connection issue')
          : t("That didn't work"),
        {
          description: errorInfo.isConnectionError
            ? t('Please try submitting the form again.')
            : errorInfo.message,
        },
      );
    }
  }, [
    isOnline,
    completeOnboarding,
    trpcUtils,
    promoteRedirect,
    redirectParam,
    t,
  ]);

  const ToSStep = useMemo(() => {
    const Step = (props: StepProps) => (
      <ToSAcceptanceScreen
        onAccept={() => {
          void handleComplete();
        }}
        onGoBack={props.onBack}
        isSubmitting={isSubmitting}
      />
    );
    return Step;
  }, [handleComplete, isSubmitting]);

  if (isSubmitting) {
    return <LoadingSpinner />;
  }

  return (
    <MultiStepForm
      steps={[PersonalDetailsForm, ToSStep]}
      schemas={[PersonalDetailsFormValidator, ToSStepValidator]}
      ProgressComponent={ProgressInPortal}
      getStepValues={getStepValues}
      hasHydrated={hasHydrated}
    />
  );
};
