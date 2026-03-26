'use client';

import { trpc } from '@op/api/client';
import { StepperProgressIndicator } from '@op/ui/Stepper';
import React, { useCallback, useMemo, useState } from 'react';
import { z } from 'zod';

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
  const [hasHydrated, setHasHydrated] = useState(false);
  const [invitesComplete, setInvitesComplete] = useState(false);
  void trpc.account.listMatchingDomainOrganizations.usePrefetchQuery();
  const { personalDetails } = useOnboardingFormStore();

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

  // Callbacks for the OrganizationSearchScreen (no-domain-match path)
  const handleSearchContinue = useCallback(
    (_selectedOrgs: Array<{ id: string; profileId: string }>) => {
      // TODO: Implemented in US-006 — submit join requests and redirect
    },
    [],
  );

  // Wrap MatchingOrganizationsFormSuspense to pass search screen callbacks
  const MatchingOrganizationsStep = useMemo(() => {
    const Step = (props: StepProps) => (
      <MatchingOrganizationsFormSuspense
        {...props}
        onSearchContinue={handleSearchContinue}
      />
    );
    return Step;
  }, [handleSearchContinue]);

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
