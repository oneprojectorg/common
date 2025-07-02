'use client';

import { trpc } from '@op/api/client';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { StepperProgressIndicator } from '@op/ui/Stepper';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import React, { useCallback, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { MultiStepForm, ProgressComponentProps } from '../MultiStepForm';
import { Portal } from '../Portal';
import {
  FundingInformationForm,
  validator as FundingInformationFormValidator,
} from './FundingInformationForm';
import {
  MatchingOrganizationsFormSuspense,
  validator as MatchingOrganizationsFormValidator,
} from './MatchingOrganizationsForm';
import { OrganizationDetailsForm } from './OrganizationDetailsForm';
import {
  PersonalDetailsForm,
  validator as PersonalDetailsFormValidator,
} from './PersonalDetailsForm';
import {
  PrivacyPolicyForm,
  validator as PrivacyPolicyFormValidator,
} from './PrivacyPolicyForm';
import { ToSForm, validator as ToSFormValidator } from './ToSForm';
import { organizationFormValidator as OrganizationDetailsFormValidator } from './shared/organizationValidation';
import { useOnboardingFormStore } from './useOnboardingFormStore';

type FormValues = z.infer<typeof PersonalDetailsFormValidator> &
  z.infer<typeof MatchingOrganizationsFormValidator> &
  z.infer<typeof OrganizationDetailsFormValidator> &
  z.infer<typeof FundingInformationFormValidator> &
  z.infer<typeof PrivacyPolicyFormValidator> &
  z.infer<typeof ToSFormValidator>;

const processInputs = (data: any) => {
  const inputs = {
    ...data,
  };

  return inputs;
};

const ProgressInPortal = (props: ProgressComponentProps) => (
  <Portal id="top-slot">
    <StepperProgressIndicator {...props} />
  </Portal>
);

export const OnboardingFlow = () => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const createOrganization = trpc.organization.create.useMutation();
  void trpc.account.listMatchingDomainOrganizations.usePrefetchQuery();
  const router = useRouter();
  const t = useTranslations();
  const {
    // reset,
    personalDetails,
    organizationDetails,
    fundingInformation,
    tos,
    privacyPolicy,
  } = useOnboardingFormStore();
  const trpcUtil = trpc.useUtils();

  // Handle hydration detection
  React.useEffect(() => {
    // Check if already hydrated (if method exists)
    if (useOnboardingFormStore.persist.hasHydrated?.()) {
      setHasHydrated(true);
      return;
    }

    // Set up hydration listener
    const unsubscribe = useOnboardingFormStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    // Fallback: assume hydrated after a short delay if callback doesn't fire
    const fallbackTimeout = setTimeout(() => {
      setHasHydrated(true);
    }, 100);

    return () => {
      unsubscribe();
      clearTimeout(fallbackTimeout);
    };
  }, []);

  // Function to get current step values from the store
  const getStepValues = useCallback(() => {
    const values = [
      personalDetails,
      {}, // MatchingOrganizationsForm expects empty object and handles its own logic
      organizationDetails,
      fundingInformation,
      tos,
      privacyPolicy,
    ];

    return values;
  }, [
    personalDetails,
    organizationDetails,
    fundingInformation,
    tos,
    privacyPolicy,
  ]);

  const onReturn = useCallback<any>(
    (values: Array<FormValues>) => {
      const combined: FormValues = values.reduce(
        (accum, val) => ({ ...accum, ...val }),
        {} as FormValues,
      );

      setSubmitting(true);

      createOrganization
        .mutateAsync(processInputs(combined))
        .then(() => {
          // invalidate account so we refetch organization users again
          trpcUtil.account.getMyAccount.reset();
          trpcUtil.account.getMyAccount.refetch().then(() => {
            router.push(`/?new=1`);
          });
        })
        .catch((err) => {
          console.error('ERROR', err);
          setSubmitting(false);
          toast.error({
            title: t("That didn't work"),
            message: t('Something went wrong on our end. Please try again'),
          });
        });
    },
    [createOrganization],
  );

  if (submitting) {
    return <LoadingSpinner />;
  }

  return hasHydrated ? (
    <MultiStepForm
      steps={[
        PersonalDetailsForm,
        MatchingOrganizationsFormSuspense,
        OrganizationDetailsForm,
        FundingInformationForm,
        ToSForm,
        PrivacyPolicyForm,
      ]}
      schemas={[
        PersonalDetailsFormValidator,
        MatchingOrganizationsFormValidator,
        OrganizationDetailsFormValidator,
        FundingInformationFormValidator,
        ToSFormValidator,
        PrivacyPolicyFormValidator,
      ]}
      onFinish={onReturn}
      ProgressComponent={ProgressInPortal}
      getStepValues={getStepValues}
      hasHydrated={hasHydrated}
    />
  ) : (
    <LoadingSpinner />
  );
};
