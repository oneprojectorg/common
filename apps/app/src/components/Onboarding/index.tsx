'use client';

import { useCompleteOnboarding } from '@/hooks/useCompleteOnboarding';
import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
import { isSafeRedirectPath } from '@op/common/client';
import { logger } from '@op/logging/client';
import { Spinner } from '@op/sense/Spinner';
import { StepperProgressIndicator } from '@op/sense/Stepper';
import { toast } from '@op/sense/Toast';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { PromoteOnboardingFlow } from './PromoteOnboardingFlow';
import { ToSAcceptanceScreen } from './ToSAcceptanceScreen';
import { organizationFormValidator as OrganizationDetailsFormValidator } from './shared/organizationValidation';
import { useOnboardingFormStore } from './useOnboardingFormStore';
import { sendOnboardingAnalytics } from './utils';

const OrganizationSearchStepValidator = z.object({});

// The ToS step collects no form values of its own.
const ToSStepValidator = z.object({});

export type FormValues = z.infer<typeof PersonalDetailsFormValidator> &
  z.infer<typeof OrganizationSearchStepValidator>;

type OrgCreationFormValues = z.infer<typeof OrganizationDetailsFormValidator> &
  z.infer<typeof FundingInformationFormValidator>;

const ProgressInPortal = (props: ProgressComponentProps) => (
  <Portal id="top-slot">
    <StepperProgressIndicator {...props} />
  </Portal>
);

// Accepting the policies is the last step, so `onNext` submits the organization.
const ToSStep = ({ onNext, onBack }: StepProps) => (
  <ToSAcceptanceScreen onAccept={() => onNext({})} onGoBack={onBack} />
);

// Prefetch for the org-search step. Only on the org-search branch: the promote
// flow skips it, and prefetching there fires a network-tier 403 for the new user.
const PrefetchDomainOrganizations = () => {
  void trpc.account.listMatchingDomainOrganizations.usePrefetchQuery();
  return null;
};

const processOrgInputs = (data: OrgCreationFormValues) => ({
  ...data,
  website: data.website ?? '',
});

export const OnboardingFlow = ({
  isNetworkMember,
}: {
  isNetworkMember: boolean;
}) => {
  const t = useTranslations();
  const router = useRouter();
  const isOnline = useConnectionStatus();
  // Return to where the layout redirect sent the user from (?redirect=), falling
  // back to the post-onboarding home. Without this the preserved destination
  // added by the (main)/(no-header) layouts is ignored for members.
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');
  const completionDestination = isSafeRedirectPath(redirectParam)
    ? redirectParam
    : '/?new=1';
  const [hasHydrated, setHasHydrated] = useState(false);
  const [invitesComplete, setInvitesComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createOrgMode, setCreateOrgMode] = useState(false);
  const {
    personalDetails,
    organizationDetails,
    fundingInformation,
    setOrganizationDetails,
  } = useOnboardingFormStore();
  const trpcUtils = trpc.useUtils();
  const { data: userAccount } = trpc.account.getMyAccount.useQuery();
  const createJoinRequest = trpc.profile.createJoinRequest.useMutation();
  const completeOnboarding = useCompleteOnboarding();
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
        toast.error(t('No connection'), {
          description: t('checkConnectionHint'),
        });
        return;
      }

      setIsSubmitting(true);

      try {
        const userProfileId = userAccount?.profile?.id;

        if (selectedOrgs.length > 0 && !userProfileId) {
          toast.error(t("That didn't work"), {
            description: t('resubmitFormHint'),
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
            toast.error(t("That didn't work"), {
              description: t('resubmitFormHint'),
            });
            setIsSubmitting(false);
            return;
          }
          if (failures.length > 0) {
            toast.error(t("That didn't work"), {
              description: t('resubmitFormHint'),
            });
          }
        }

        await completeOnboarding();
        await trpcUtils.account.getMyAccount.invalidate();
        await trpcUtils.account.getMyAccount.refetch();
        router.push(completionDestination);
      } catch (err) {
        setIsSubmitting(false);
        const errorInfo = analyzeError(err);
        if (errorInfo.isConnectionError) {
          toast.error(t('Connection issue'), {
            description: t('resubmitFormHint'),
          });
        } else {
          toast.error(t("That didn't work"), {
            description: errorInfo.message,
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
      completionDestination,
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
    return [organizationDetails, fundingInformation, {}];
  }, [organizationDetails, fundingInformation]);

  // Submit org creation
  const submitOrganization = useCallback(() => {
    if (!isOnline) {
      toast.error(t('No connection'), {
        description: t('checkConnectionHint'),
      });
      return;
    }

    setIsSubmitting(true);

    // Build from the persisted store, not MultiStepForm's ephemeral local
    // state — the local array is lost on any remount (retry-after-failure,
    // page refresh), which drops org details and submits undefined orgType/bio.
    const combined = getOrgCreationStepValues().reduce(
      (acc, val) => ({ ...acc, ...val }),
      {} as OrgCreationFormValues,
    );

    createOrganization
      .mutateAsync(processOrgInputs(combined))
      .then(async () => {
        sendOnboardingAnalytics(combined);
        await completeOnboarding();
        await trpcUtils.account.getMyAccount.invalidate();
        await trpcUtils.account.getMyAccount.refetch();
        router.push(completionDestination);
      })
      .catch((err) => {
        logger.error('Onboarding: failed to create organization', {
          error: err,
          context: 'Onboarding.createOrganization',
        });
        setIsSubmitting(false);

        const errorInfo = analyzeError(err);
        if (errorInfo.isConnectionError) {
          toast.error(t('Connection issue'), {
            description: t('resubmitFormHint'),
          });
        } else {
          toast.error(t("That didn't work"), {
            description: errorInfo.message,
          });
        }
      });
  }, [
    createOrganization,
    isOnline,
    router,
    trpcUtils,
    t,
    getOrgCreationStepValues,
    completeOnboarding,
    completionDestination,
  ]);

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
    return <Spinner className="size-6" />;
  }

  // Non-members get the org-less journey; members get the full org flow. Keyed
  // on membership, not `?promote=1`, which is gone once a user returns.
  if (!isNetworkMember) {
    return <PromoteOnboardingFlow hasHydrated={hasHydrated} />;
  }

  if (createOrgMode) {
    return (
      <MultiStepForm
        steps={[OrganizationDetailsForm, FundingInformationForm, ToSStep]}
        schemas={[
          OrganizationDetailsFormValidator,
          FundingInformationFormValidator,
          ToSStepValidator,
        ]}
        onFinish={submitOrganization}
        ProgressComponent={ProgressInPortal}
        getStepValues={getOrgCreationStepValues}
        hasHydrated={hasHydrated}
      />
    );
  }

  return (
    <>
      <PrefetchDomainOrganizations />
      <MultiStepForm
        steps={[PersonalDetailsForm, OrganizationSearchStep]}
        schemas={[
          PersonalDetailsFormValidator,
          OrganizationSearchStepValidator,
        ]}
        ProgressComponent={ProgressInPortal}
        getStepValues={getStepValues}
        hasHydrated={hasHydrated}
      />
    </>
  );
};
