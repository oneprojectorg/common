'use client';

import { makeArray } from '@/utils';
import { trpc } from '@op/api/client';
import { useInfiniteScroll } from '@op/hooks';
import { SkeletonLine } from '@op/ui/Skeleton';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';

import { OrganizationList } from '../OrganizationList';

export const NewOrganizationsSuspense = ({
  limit = 10,
}: {
  limit?: number;
}) => {
  const searchParams = useSearchParams();
  const termsFilter = makeArray(searchParams.get('terms'));

  const [initialData] = trpc.organization.list.useSuspenseQuery({
    limit,
    terms: termsFilter,
    cursor: null,
  });

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
    {
      initialData: {
        pages: [initialData],
        pageParams: [null],
      },
      getNextPageParam: (lastPage) => lastPage.next,
    },
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

export const NewOrganizations = ({ limit }: { limit?: number }) => {
  return (
    <ErrorBoundary fallback={<div>Could not load organizations</div>}>
      <Suspense fallback={<SkeletonLine lines={5} />}>
        <NewOrganizationsSuspense limit={limit} />
      </Suspense>
    </ErrorBoundary>
  );
};
