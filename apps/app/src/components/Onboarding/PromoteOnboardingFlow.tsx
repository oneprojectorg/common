'use client';

import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import { isSafeRedirectPath } from '@op/common/client';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { StepperProgressIndicator } from '@op/ui/Stepper';
import { toast } from '@op/ui/Toast';
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
 * Onboarding journey for an anonymous visitor who just upgraded to a full
 * account (see LinkAccountPanel / PromoteAccountModal). Reached at
 * `/start?promote=1`.
 *
 * Unlike the normal flow it skips organization joining/creation entirely:
 * personal details, accept ToS, then hard-navigate back to the decision they
 * came from so the now-authenticated tree mounts with a fresh cache.
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
  const promoteRedirect = isSafeRedirectPath(redirectParam)
    ? redirectParam
    : '/';

  const getStepValues = useCallback(() => {
    return [personalDetails, {}];
  }, [personalDetails]);

  const handleComplete = useCallback(async () => {
    if (!isOnline) {
      toast.error({
        title: t('No connection'),
        message: t('Please check your internet connection and try again.'),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      await completeOnboarding.mutateAsync({ tos: true, privacy: true });
      await trpcUtils.account.getMyAccount.invalidate();
      window.location.assign(promoteRedirect);
    } catch (err) {
      setIsSubmitting(false);
      const errorInfo = analyzeError(err);
      toast.error({
        title: errorInfo.isConnectionError
          ? t('Connection issue')
          : t("That didn't work"),
        message: errorInfo.isConnectionError
          ? t('Please try submitting the form again.')
          : errorInfo.message,
      });
    }
  }, [isOnline, completeOnboarding, trpcUtils, promoteRedirect, t]);

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
