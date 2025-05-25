'use client';

import { trpc } from '@op/api/client';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';

import {
  OrganizationListSkeleton,
  OrganizationSummaryList,
} from '../OrganizationList';

export const OrganizationSearchResultsSuspense = ({
  query,
  limit = 10,
}: {
  query: string;
  limit?: number;
}) => {
  const [organizations] = trpc.organization.search.useSuspenseQuery({
    limit,
    q: query,
  });

  return <OrganizationSummaryList organizations={organizations} />;
};

export const OrganizationSearchResults = ({
  limit,
  query,
}: {
  query: string;
  limit?: number;
}) => {
  return (
    <ErrorBoundary fallback={<div>Could not load search results</div>}>
      <Suspense fallback={<OrganizationListSkeleton />}>
        <OrganizationSearchResultsSuspense query={query} limit={limit} />
      </Suspense>
    </ErrorBoundary>
  );
};
