'use client';

import { trpc } from '@op/api/client';
import { EntityType } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

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
  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.profile.list.useInfiniteQuery(
    {
      limit,
      types: types ?? [EntityType.ORG],
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
  const t = useTranslations();
  
  return (
    <ErrorBoundary fallback={<div>{t('Could not load organizations')}</div>}>
      <Suspense fallback={<SkeletonLine lines={5} />}>
        <AllOrganizationsSuspense {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};
