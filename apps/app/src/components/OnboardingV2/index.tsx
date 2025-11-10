'use client';

import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { StepperProgressIndicator } from '@op/ui/Stepper';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import React, { useCallback, useState } from 'react';
import { z } from 'zod';

import { MultiStepForm, ProgressComponentProps } from '../MultiStepForm';
import { Portal } from '../Portal';
import { OrganizationDetailsForm } from './OrganizationDetailsForm';
import {
  OrganizationsSearchFormSuspense,
  validator as OrganizationsSearchFormValidator,
} from './OrganizationsSearchForm';
import {
  PersonalDetailsForm,
  validator as PersonalDetailsFormValidator,
} from './PersonalDetailsForm';
import {
  PoliciesForm,
  validator as PoliciesFormValidator,
} from './PoliciesForm';
import {
  RolesAtOrganizationsFormSuspense,
  validator as RolesAtOrganizationsFormValidator,
} from './RolesAtOrganizationsForm';
import { organizationFormValidator as OrganizationDetailsFormValidator } from './shared/organizationValidation';
import { useOnboardingFormStore } from './useOnboardingFormStore';
import { sendOnboardingAnalytics } from './utils';

export type FormValues = z.infer<typeof PersonalDetailsFormValidator> &
  z.infer<typeof PoliciesFormValidator> &
  z.infer<typeof OrganizationDetailsFormValidator> &
  z.infer<typeof RolesAtOrganizationsFormValidator>;

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

export const OnboardingFlowV2 = () => {
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [hasHydrated, setHasHydrated] = useState(false);
  const createOrganization = trpc.organization.create.useMutation();
  void trpc.account.listMatchingDomainOrganizations.usePrefetchQuery();
  const router = useRouter();
  const isOnline = useConnectionStatus();
  const {
    // reset,
    lastStep,
    personalDetails,
    selectedOrganizations,
    rolesAtOrganizations,
    policies,
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
      selectedOrganizations,
      rolesAtOrganizations,
      policies,
    ];

    return values;
  }, [personalDetails, selectedOrganizations, rolesAtOrganizations, policies]);

  // Function to get which steps have been hidden
  const getLastStep = useCallback(() => {
    return lastStep;
  }, [lastStep]);

  const submitOrganization = useCallback(
    (formData: FormValues) => {
      if (!isOnline) {
        toast.error({
          title: 'No connection',
          message: 'Please check your internet connection and try again.',
        });
        return;
      }

      setSubmitting(true);

      createOrganization
        .mutateAsync(processInputs(formData))
        .then(() => {
          sendOnboardingAnalytics(formData);
          // invalidate account so we refetch organization users again
          trpcUtil.account.getMyAccount.invalidate();
          trpcUtil.account.getMyAccount.reset();
          trpcUtil.account.getMyAccount.refetch().then(() => {
            router.push(`/?new=1`);
          });
        })
        .catch((err) => {
          console.error('ERROR', err);
          setSubmitting(false);

          const errorInfo = analyzeError(err);

          if (errorInfo.isConnectionError) {
            toast.error({
              title: 'Connection issue',
              message:
                errorInfo.message + ' Please try submitting the form again.',
            });
          } else {
            toast.error({
              title: "That didn't work",
              message: errorInfo.message,
            });
          }
        });
    },
    [createOrganization, isOnline, router, trpcUtil],
  );

  const onReturn = useCallback<any>(
    (values: Array<FormValues>) => {
      const combined: FormValues = values.reduce(
        (accum, val) => ({ ...accum, ...val }),
        {} as FormValues,
      );

      submitOrganization(combined);
    },
    [submitOrganization],
  );

  if (submitting) {
    return <LoadingSpinner />;
  }

  return hasHydrated ? (
    <MultiStepForm
      steps={[
        PersonalDetailsForm,
        OrganizationsSearchFormSuspense,
        RolesAtOrganizationsFormSuspense,
        PoliciesForm,
      ]}
      schemas={[
        PersonalDetailsFormValidator,
        OrganizationsSearchFormValidator,
        RolesAtOrganizationsFormValidator,
        PoliciesFormValidator,
      ]}
      onFinish={onReturn}
      ProgressComponent={ProgressInPortal}
      getStepValues={getStepValues}
      getLastStep={getLastStep}
      hasHydrated={hasHydrated}
    />
  ) : (
    <LoadingSpinner />
  );
};
