'use client';

import { trpc } from '@op/api/client';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ReactNode, Suspense } from 'react';

import ErrorBoundary from '../ErrorBoundary';
import { ErrorMessage } from '../ErrorMessage';
import { OnboardingCenterLayout } from './OnboardingCenterLayout';
import {
  OrganizationSearchScreen,
  OrganizationSearchScreenProps,
} from './OrganizationSearchScreen';

type OrganizationSearchScreenSuspenseProps = Omit<
  OrganizationSearchScreenProps,
  'initialOrganizations'
>;

const OrganizationSearchScreenWithDomainMatch = (
  props: OrganizationSearchScreenSuspenseProps,
): ReactNode => {
  const [matchingOrgs] =
    trpc.account.listMatchingDomainOrganizations.useSuspenseQuery();

  return (
    <OrganizationSearchScreen
      {...props}
      initialOrganizations={matchingOrgs.length > 0 ? matchingOrgs : undefined}
    />
  );
};

export const OrganizationSearchScreenSuspense = (
  props: OrganizationSearchScreenSuspenseProps,
) => {
  return (
    <ErrorBoundary fallback={<ErrorMessage />}>
      <Suspense
        fallback={
          <OnboardingCenterLayout title="" subtitle="">
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          </OnboardingCenterLayout>
        }
      >
        <OrganizationSearchScreenWithDomainMatch {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
