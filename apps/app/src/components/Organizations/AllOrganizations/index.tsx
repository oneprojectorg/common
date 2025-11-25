'use client';

import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { SkeletonLine } from '@op/ui/Skeleton';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { ProfileSummaryList } from '@/components/ProfileList';

type ProfileListResponse = {
  items: Array<any>;
  next?: string | null;
  hasMore: boolean;
};

export const AllOrganizationsSuspense = ({
  limit = 20,
  initialData,
  types,
}: {
  limit?: number;
  initialData?: ProfileListResponse;
  types?: EntityType[];
}) => {
  const input = {
    limit,
    types: types ?? [EntityType.ORG],
  };

  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: [['profile', 'list'], input],
    queryFn: ({ pageParam }) =>
      trpc.profile.list.query({ ...input, cursor: pageParam }),
    initialPageParam: null as string | null | undefined,
    getNextPageParam: (lastPage) => lastPage.next,
    ...(initialData
      ? {
          initialData: {
            pages: [initialData],
            pageParams: [null],
          },
        }
      : {}),
  });

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
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="flex justify-center py-4"
        >
          {isFetchingNextPage ? (
            <div className="text-sm text-neutral-gray4">
              <SkeletonLine lines={3} />
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
      <Suspense fallback={<SkeletonLine lines={5} />}>
        <AllOrganizationsSuspense {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
