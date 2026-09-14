'use client';
import { type RouterOutput, useTRPC } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { PAGE_LIMIT, nextCursor } from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { SkeletonText } from '@op/sense/Skeleton';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ProfileSummaryList } from '@/components/ProfileList';

// Derived from the procedure rather than hand-written: React Query types
// `initialData` against the query's own output, so a looser local shape (an
// optional `next`) no longer satisfies it.
type ProfileListResponse = RouterOutput['profile']['list'];

export const AllOrganizationsSuspense = ({
  limit = PAGE_LIMIT.md,
  initialData,
  types,
}: {
  limit?: number;
  initialData?: ProfileListResponse;
  types?: EntityType[];
}) => {
  const trpc = useTRPC();
  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery(
    trpc.profile.list.infiniteQueryOptions(
      {
        limit,
        types: types ?? [EntityType.ORG],
      },
      {
        getNextPageParam: nextCursor,
        ...(initialData
          ? {
              initialData: {
                pages: [initialData],
                pageParams: [null],
              },
            }
          : {}),
      },
    ),
  );

  const { ref, shouldShowTrigger } = useInfiniteScroll(fetchNextPage, {
    hasNextPage,
    isFetchingNextPage,
    threshold: 0.1,
    rootMargin: '100px',
  });

  const allProfiles = paginatedData?.pages.flatMap((page) => page.items) || [];

  return (
    <div className="flex flex-col gap-4">
      <ProfileSummaryList profiles={allProfiles} />
      {shouldShowTrigger && (
        <div ref={ref} className="flex justify-center py-4">
          {isFetchingNextPage ? (
            <div className="text-sm text-muted-foreground">
              <SkeletonText lines={3} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export const AllOrganizations = (props: {
  limit?: number;
  initialData?: ProfileListResponse;
  types?: EntityType[];
}) => {
  return (
    <ErrorBoundary fallback={<div>Could not load organizations</div>}>
      <Suspense fallback={<SkeletonText lines={5} />}>
        <AllOrganizationsSuspense {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
