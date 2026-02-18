'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { Skeleton } from '@op/ui/Skeleton';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

import { DecisionListItem } from '../DecisionListItem';

const DecisionListItemSkeleton = () => (
  <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-none sm:border-0 sm:border-b sm:border-b-neutral-gray1">
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-16 rounded" />
      </div>
      <div className="flex items-center gap-1">
        <Skeleton className="size-4 rounded" />
        <Skeleton className="h-3.5 w-24" />
      </div>
    </div>
    <div className="flex items-center gap-12">
      <div className="flex flex-col items-center gap-1">
        <Skeleton className="h-5 w-6" />
        <Skeleton className="h-3.5 w-16" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <Skeleton className="h-5 w-6" />
        <Skeleton className="h-3.5 w-14" />
      </div>
    </div>
  </div>
);

const DecisionsListSkeleton = () => (
  <div className="flex flex-col gap-4 sm:gap-0">
    {Array.from({ length: 3 }).map((_, i) => (
      <DecisionListItemSkeleton key={i} />
    ))}
  </div>
);

const DecisionsListSuspense = ({
  status,
  ownerProfileId,
}: {
  status: ProcessStatus[];
  ownerProfileId?: string;
}) => {
  const {
    data: paginatedData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.decision.listDecisionProfiles.useInfiniteQuery(
    {
      limit: 20,
      status,
      ownerProfileId,
    },
    {
      getNextPageParam: (lastPage) => lastPage.next,
    },
  );

  const { ref, shouldShowTrigger } = useInfiniteScroll(fetchNextPage, {
    hasNextPage,
    isFetchingNextPage,
    threshold: 0.1,
    rootMargin: '100px',
  });

  const paginatedItems =
    paginatedData?.pages.flatMap((page) => page.items) || [];

  if (paginatedItems.length === 0) {
    return (
      <div className="py-8 text-center text-neutral-gray4">
        No processes found
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-0">
      {paginatedItems.map((item) => (
        <DecisionListItem key={item.id} item={item} />
      ))}
      {shouldShowTrigger && (
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="flex justify-center py-4"
        >
          {isFetchingNextPage ? <DecisionListItemSkeleton /> : null}
        </div>
      )}
    </div>
  );
};

const AllDecisionsTabs = () => {
  const t = useTranslations();
  const { user } = useUser();
  const ownerProfileId = user.currentProfile?.id;

  const [draftsCheck] = trpc.decision.listDecisionProfiles.useSuspenseQuery({
    limit: 1,
    status: [ProcessStatus.DRAFT],
    ownerProfileId,
  });

  const hasDrafts = draftsCheck.items.length > 0;

  return (
    <Tabs defaultSelectedKey="active">
      <TabList variant="pill" className="gap-4 border-none">
        <Tab id="active" variant="pill">
          Your active processes
        </Tab>
        {hasDrafts && (
          <Tab id="drafts" variant="pill">
            {t('Your drafts')}
          </Tab>
        )}
        <Tab id="other" variant="pill">
          Other processes
        </Tab>
      </TabList>
      <TabPanel id="active" className="p-0 sm:p-0">
        <Suspense fallback={<DecisionsListSkeleton />}>
          <DecisionsListSuspense status={[ProcessStatus.PUBLISHED]} />
        </Suspense>
      </TabPanel>
      {hasDrafts && (
        <TabPanel id="drafts" className="p-0 sm:p-0">
          <Suspense fallback={<DecisionsListSkeleton />}>
            <DecisionsListSuspense
              status={[ProcessStatus.DRAFT]}
              ownerProfileId={ownerProfileId}
            />
          </Suspense>
        </TabPanel>
      )}
      <TabPanel id="other" className="p-0 sm:p-0">
        <Suspense fallback={<DecisionsListSkeleton />}>
          <DecisionsListSuspense status={[ProcessStatus.COMPLETED]} />
        </Suspense>
      </TabPanel>
    </Tabs>
  );
};

export const AllDecisions = () => {
  const { user } = useUser();

  return (
    <ErrorBoundary fallback={<div>Could not load decisions</div>}>
      <Suspense fallback={<DecisionsListSkeleton />}>
        <AllDecisionsTabs key={user.currentProfile?.id} />
      </Suspense>
    </ErrorBoundary>
  );
};
