'use client';

import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { StepperProgressIndicator } from '@op/ui/Stepper';
import { toast } from '@op/ui/Toast';
import { useRouter } from 'next/navigation';
import React, { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import {
  MultiStepForm,
  ProgressComponentProps,
  StepProps,
} from '../MultiStepForm';
import { Portal } from '../Portal';
import { DecisionInvitesFormSuspense } from './DecisionInvitesForm';
import { DecisionInvitesSkeleton } from './DecisionInvitesSkeleton';
import {
  FundingInformationForm,
  validator as FundingInformationFormValidator,
} from './FundingInformationForm';
import { OrganizationDetailsForm } from './OrganizationDetailsForm';
import { OrganizationSearchScreenSuspense } from './OrganizationSearchScreenSuspense';
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
import { sendOnboardingAnalytics } from './utils';

const OrganizationSearchStepValidator = z.object({});

export type FormValues = z.infer<typeof PersonalDetailsFormValidator> &
  z.infer<typeof OrganizationSearchStepValidator>;

type OrgCreationFormValues = z.infer<typeof OrganizationDetailsFormValidator> &
  z.infer<typeof FundingInformationFormValidator> &
  z.infer<typeof ToSFormValidator> &
  z.infer<typeof PrivacyPolicyFormValidator>;

const ProgressInPortal = (props: ProgressComponentProps) => (
  <Portal id="top-slot">
    <StepperProgressIndicator {...props} />
  </Portal>
);

const processOrgInputs = (data: OrgCreationFormValues) => ({
  ...data,
  website: data.website ?? '',
});

export const OnboardingFlow = () => {
  const t = useTranslations();
  const router = useRouter();
  const isOnline = useConnectionStatus();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [invitesComplete, setInvitesComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createOrgMode, setCreateOrgMode] = useState(false);
  void trpc.account.listMatchingDomainOrganizations.usePrefetchQuery();
  const {
    personalDetails,
    organizationDetails,
    fundingInformation,
    tos,
    privacyPolicy,
    setOrganizationDetails,
  } = useOnboardingFormStore();
  const trpcUtils = trpc.useUtils();
  const { data: userAccount } = trpc.account.getMyAccount.useQuery();
  const createJoinRequest = trpc.profile.createJoinRequest.useMutation();
  const completeOnboarding = trpc.account.completeOnboarding.useMutation();
  const createOrganization = trpc.organization.create.useMutation();

  // Handle hydration detection
  React.useEffect(() => {
    if (useOnboardingFormStore.persist.hasHydrated?.()) {
      setHasHydrated(true);
      return;
    }

    const unsubscribe = useOnboardingFormStore.persist.onFinishHydration(() => {
      setHasHydrated(true);
    });

    const fallbackTimeout = setTimeout(() => {
      setHasHydrated(true);
    }, 100);

    return () => {
      unsubscribe();
      clearTimeout(fallbackTimeout);
    };
  }, []);

  const getStepValues = useCallback(() => {
    return [
      personalDetails,
      {}, // OrganizationSearchScreen handles its own logic
    ];
  }, [personalDetails]);

  // Submit join requests for selected organizations and redirect
  const handleSearchContinue = useCallback(
    async (selectedOrgs: Array<{ id: string; profileId: string }>) => {
      if (!isOnline) {
        toast.error({
          title: t('No connection'),
          message: t('Please check your internet connection and try again.'),
        });
        return;
      }

      setIsSubmitting(true);

      try {
        const userProfileId = userAccount?.profile?.id;

        if (selectedOrgs.length > 0 && !userProfileId) {
          toast.error({
            title: t("That didn't work"),
            message: t('Please try submitting the form again.'),
          });
          setIsSubmitting(false);
          return;
        }

        if (selectedOrgs.length > 0 && userProfileId) {
          const results = await Promise.allSettled(
            selectedOrgs.map((org) =>
              createJoinRequest.mutateAsync({
                requestProfileId: userProfileId,
                targetProfileId: org.profileId,
              }),
            ),
          );

          const failures = results.filter((r) => r.status === 'rejected');
          if (failures.length === results.length) {
            toast.error({
              title: t("That didn't work"),
              message: t('Please try submitting the form again.'),
            });
            setIsSubmitting(false);
            return;
          }
          if (failures.length > 0) {
            toast.error({
              title: t("That didn't work"),
              message: t('Please try submitting the form again.'),
            });
          }
        }

        await completeOnboarding.mutateAsync({ tos: true, privacy: true });
        await trpcUtils.account.getMyAccount.invalidate();
        await trpcUtils.account.getMyAccount.refetch();
        router.push('/?new=1');
      } catch (err) {
        setIsSubmitting(false);
        const errorInfo = analyzeError(err);
        if (errorInfo.isConnectionError) {
          toast.error({
            title: t('Connection issue'),
            message: t('Please try submitting the form again.'),
          });
        } else {
          toast.error({
            title: t("That didn't work"),
            message: errorInfo.message,
          });
        }
      }
    },
    [
      isOnline,
      userAccount,
      createJoinRequest,
      completeOnboarding,
      trpcUtils,
      router,
      t,
    ],
  );

  // Handle "+ Add" org creation: pre-populate name and switch to org creation flow
  const handleAddOrganization = useCallback(
    (searchTerm: string) => {
      setOrganizationDetails({ name: searchTerm });
      setCreateOrgMode(true);
    },
    [setOrganizationDetails],
  );

  // Wrap OrganizationSearchScreen to pass callbacks and domain-matched orgs
  const OrganizationSearchStep = useMemo(() => {
    const Step = (_props: StepProps) => (
      <OrganizationSearchScreenSuspense
        onContinue={handleSearchContinue}
        onAddOrganization={handleAddOrganization}
      />
    );
    return Step;
  }, [handleSearchContinue, handleAddOrganization]);

  // Get step values for org creation flow
  const getOrgCreationStepValues = useCallback(() => {
    return [organizationDetails, fundingInformation, tos, privacyPolicy];
  }, [organizationDetails, fundingInformation, tos, privacyPolicy]);

  // Submit org creation
  const submitOrganization = useCallback(
    (values: Array<OrgCreationFormValues>) => {
      if (!isOnline) {
        toast.error({
          title: t('No connection'),
          message: t('Please check your internet connection and try again.'),
        });
        return;
      }

      setIsSubmitting(true);

      const combined = values.reduce(
        (acc, val) => ({ ...acc, ...val }),
        {} as OrgCreationFormValues,
      );

      createOrganization
        .mutateAsync(processOrgInputs(combined))
        .then(async () => {
          sendOnboardingAnalytics(combined);
          await completeOnboarding.mutateAsync({ tos: true, privacy: true });
          await trpcUtils.account.getMyAccount.invalidate();
          await trpcUtils.account.getMyAccount.refetch();
          router.push('/?new=1');
        })
        .catch((err) => {
          console.error('ERROR', err);
          setIsSubmitting(false);

          const errorInfo = analyzeError(err);
          if (errorInfo.isConnectionError) {
            toast.error({
              title: t('Connection issue'),
              message: t('Please try submitting the form again.'),
            });
          } else {
            toast.error({
              title: t("That didn't work"),
              message: errorInfo.message,
            });
          }
        });
    },
    [createOrganization, isOnline, router, trpcUtils, t],
  );

  if (!hasHydrated) {
    return <DecisionInvitesSkeleton />;
  }

  if (!invitesComplete) {
    return (
      <DecisionInvitesFormSuspense
        onComplete={() => setInvitesComplete(true)}
      />
    );
  }

  if (isSubmitting) {
    return <LoadingSpinner />;
  }

  if (createOrgMode) {
    return (
      <MultiStepForm
        steps={[
          OrganizationDetailsForm,
          FundingInformationForm,
          ToSForm,
          PrivacyPolicyForm,
        ]}
        schemas={[
          OrganizationDetailsFormValidator,
          FundingInformationFormValidator,
          ToSFormValidator,
          PrivacyPolicyFormValidator,
        ]}
        onFinish={submitOrganization}
        ProgressComponent={ProgressInPortal}
        getStepValues={getOrgCreationStepValues}
        hasHydrated={hasHydrated}
      />
    );
  }

  return (
    <MultiStepForm
      steps={[PersonalDetailsForm, OrganizationSearchStep]}
      schemas={[PersonalDetailsFormValidator, OrganizationSearchStepValidator]}
      ProgressComponent={ProgressInPortal}
      getStepValues={getStepValues}
      hasHydrated={hasHydrated}
    />
  );
};
