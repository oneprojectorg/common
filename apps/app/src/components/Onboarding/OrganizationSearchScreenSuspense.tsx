'use client';

import { trpc } from '@op/api/client';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ReactNode, Suspense } from 'react';

import ErrorBoundary from '../ErrorBoundary';
import { ErrorMessage } from '../ErrorMessage';
import { FormContainer } from '../form/FormContainer';
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
          <div>
            <FormContainer>
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
              </div>
            </FormContainer>
          </div>
        }
      >
        <OrganizationSearchScreenWithDomainMatch {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
