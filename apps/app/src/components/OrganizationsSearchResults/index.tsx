'use client';

import { trpc } from '@op/api/client';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';

import {
  OrganizationListSkeleton,
  OrganizationSummaryList,
} from '../OrganizationList';
import { ListPageLayoutHeader } from '../layout/ListPageLayout';

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

  return organizations.length > 0 ? (
    <>
      <ListPageLayoutHeader>
        <span className="text-neutral-gray4">Results for</span>{' '}
        <span className="text-neutral-black">{query}</span>
      </ListPageLayoutHeader>
      <OrganizationSummaryList organizations={organizations} />
    </>
  ) : (
    <>
      <ListPageLayoutHeader className="flex justify-center gap-2">
        <span className="text-neutral-gray4">No results for </span>
        <span className="text-neutral-black">{query}</span>
      </ListPageLayoutHeader>
      <div className="flex justify-center">
        <span className="max-w-96 text-center text-neutral-black">
          You may want to try using different keywords, checking for typos, or
          adjusting your filters.
        </span>
      </div>
    </>
  );
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
