import { makeArray } from '@/utils';
import { trpc } from '@op/api/client';
import { SkeletonLine } from '@op/ui/Skeleton';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';

import { OrganizationList } from '../OrganizationList';

export const NewOrganizationsSuspense = ({
  limit = 10,
}: {
  limit?: number;
}) => {
  const searchParams = useSearchParams();
  const termsFilter = makeArray(searchParams.get('terms'));
  const [cursor, setCursor] = useState<string | null>(null);

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

  const allOrganizations =
    paginatedData?.pages.flatMap((page) => page.items) || [];

  return (
    <div className="flex flex-col gap-4">
      <OrganizationList organizations={allOrganizations} />
      {hasNextPage && (
        <button
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="text-sm text-teal hover:underline disabled:opacity-50"
        >
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </button>
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
