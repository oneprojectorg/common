'use client';

import { analyzeError, useConnectionStatus } from '@/utils/connectionErrors';
import { trpc } from '@op/api/client';
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
  MatchingOrganizationsFormSuspense,
  validator as MatchingOrganizationsFormValidator,
} from './MatchingOrganizationsForm';
import {
  PersonalDetailsForm,
  validator as PersonalDetailsFormValidator,
} from './PersonalDetailsForm';
import { useOnboardingFormStore } from './useOnboardingFormStore';

export type FormValues = z.infer<typeof PersonalDetailsFormValidator> &
  z.infer<typeof MatchingOrganizationsFormValidator>;

const ProgressInPortal = (props: ProgressComponentProps) => (
  <Portal id="top-slot">
    <StepperProgressIndicator {...props} />
  </Portal>
);

export const OnboardingFlow = () => {
  const t = useTranslations();
  const router = useRouter();
  const isOnline = useConnectionStatus();
  const [hasHydrated, setHasHydrated] = useState(false);
  const [invitesComplete, setInvitesComplete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  void trpc.account.listMatchingDomainOrganizations.usePrefetchQuery();
  const { personalDetails } = useOnboardingFormStore();
  const trpcUtils = trpc.useUtils();
  const { data: userAccount } = trpc.account.getMyAccount.useQuery();
  const createJoinRequest = trpc.profile.createJoinRequest.useMutation();

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
      {}, // MatchingOrganizationsForm handles its own logic
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
        const currentProfileId = userAccount?.profile?.id;

        // If user selected orgs, submit join requests
        if (selectedOrgs.length > 0 && currentProfileId) {
          const results = await Promise.allSettled(
            selectedOrgs.map((org) =>
              createJoinRequest.mutateAsync({
                requestProfileId: currentProfileId,
                targetProfileId: org.profileId,
              }),
            ),
          );

          const failures = results.filter((r) => r.status === 'rejected');
          if (failures.length > 0 && failures.length < results.length) {
            toast.error({
              title: t("That didn't work"),
              message: t('Please try submitting the form again.'),
            });
          } else if (failures.length === results.length) {
            toast.error({
              title: t("That didn't work"),
              message: t('Please try submitting the form again.'),
            });
            setIsSubmitting(false);
            return;
          }
        }

        // Invalidate and redirect
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
    [isOnline, userAccount, createJoinRequest, trpcUtils, router, t],
  );

  // Wrap MatchingOrganizationsFormSuspense to pass search screen callbacks
  const MatchingOrganizationsStep = useMemo(() => {
    const Step = (props: StepProps) => (
      <MatchingOrganizationsFormSuspense
        {...props}
        onSearchContinue={handleSearchContinue}
        isSubmitting={isSubmitting}
      />
    );
    return Step;
  }, [handleSearchContinue, isSubmitting]);

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

  return (
    <MultiStepForm
      steps={[PersonalDetailsForm, MatchingOrganizationsStep]}
      schemas={[
        PersonalDetailsFormValidator,
        MatchingOrganizationsFormValidator,
      ]}
      ProgressComponent={ProgressInPortal}
      getStepValues={getStepValues}
      hasHydrated={hasHydrated}
    />
  );
};
