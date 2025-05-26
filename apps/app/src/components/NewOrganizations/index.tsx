'use client';

import { makeArray } from '@/utils';
import { trpc } from '@op/api/client';
import { Organization } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { SkeletonLine } from '@op/ui/Skeleton';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';

import { OrganizationList } from '../OrganizationList';

export type OrganizationListResponse = {
  items: Array<Organization>;
  next?: string | null;
  hasMore: boolean;
};

export const NewOrganizationsSuspense = ({
  limit = 10,
  initialData,
}: {
  limit?: number;
  initialData?: OrganizationListResponse;
}) => {
  const searchParams = useSearchParams();
  const termsFilter = makeArray(searchParams.get('terms'));

  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.organization.list.useInfiniteQuery(
    {
      limit,
      terms: termsFilter,
    },
    initialData
      ? {
          initialData: {
            pages: [initialData],
            pageParams: [null],
          },
          getNextPageParam: (lastPage) => lastPage.next,
        }
      : undefined,
  );

  const { ref, shouldShowTrigger } = useInfiniteScroll(fetchNextPage, {
    hasNextPage,
    isFetchingNextPage,
    threshold: 0.1,
    rootMargin: '100px',
  });

  const allOrganizations =
    paginatedData?.pages.flatMap((page) => page.items) || [];

  return (
    <div className="flex flex-col gap-4">
      <OrganizationList organizations={allOrganizations} />
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

export const NewOrganizations = ({
  limit,
  initialData,
}: {
  limit?: number;
  initialData?: OrganizationListResponse;
}) => {
  return (
    <ErrorBoundary fallback={<div>Could not load organizations</div>}>
      <Suspense fallback={<SkeletonLine lines={5} />}>
        <NewOrganizationsSuspense initialData={initialData} limit={limit} />
      </Suspense>
    </ErrorBoundary>
  );
};
