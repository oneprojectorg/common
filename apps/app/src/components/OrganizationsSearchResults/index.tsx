'use client';

import { trpc } from '@op/api/client';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';

import { ProfileListSkeleton, ProfileSummaryList } from '../ProfileList';
import { ListPageLayoutHeader } from '../layout/ListPageLayout';

export const ProfileSearchResultsSuspense = ({
  query,
  limit = 10,
}: {
  query: string;
  limit?: number;
}) => {
  const [profiles] = trpc.profile.search.useSuspenseQuery({
    limit,
    q: query,
  });

  return profiles.length > 0 ? (
    <>
      <ListPageLayoutHeader>
        <span className="text-neutral-gray4">Results for</span>{' '}
        <span className="text-neutral-black">{query}</span>
      </ListPageLayoutHeader>
      <ProfileSummaryList profiles={profiles} />
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

export const ProfileSearchResults = ({
  limit,
  query,
}: {
  query: string;
  limit?: number;
}) => {
  return (
    <ErrorBoundary fallback={<div>Could not load search results</div>}>
      <Suspense fallback={<ProfileListSkeleton />}>
        <ProfileSearchResultsSuspense query={query} limit={limit} />
      </Suspense>
    </ErrorBoundary>
  );
};

// Keep the old export for backward compatibility
export const OrganizationSearchResults = ProfileSearchResults;
