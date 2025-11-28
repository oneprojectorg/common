'use client';

import { RouterOutput, trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Suspense } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';

import { DecisionListItem } from '../DecisionListItem';

type DecisionProfileListResponse =
  RouterOutput['decision']['listDecisionProfiles'];

const DecisionsList = ({
  status,
  initialData,
}: {
  status: ProcessStatus;
  initialData?: DecisionProfileListResponse;
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
    },
    initialData
      ? {
          initialData: {
            pages: [initialData],
            pageParams: [null],
          },
          getNextPageParam: (lastPage) => lastPage.next,
        }
      : {
          getNextPageParam: (lastPage) => lastPage.next,
        },
  );

  const { ref, shouldShowTrigger } = useInfiniteScroll(fetchNextPage, {
    hasNextPage,
    isFetchingNextPage,
    threshold: 0.1,
    rootMargin: '100px',
  });

  const allItems = paginatedData?.pages.flatMap((page) => page.items) || [];

  if (allItems.length === 0) {
    return (
      <div className="py-8 text-center text-neutral-gray4">
        No processes found
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-0">
      {allItems.map((item) => (
        <DecisionListItem key={item.id} item={item} />
      ))}
      {shouldShowTrigger && (
        <div
          ref={ref as React.RefObject<HTMLDivElement>}
          className="flex justify-center py-4"
        >
          {isFetchingNextPage ? <SkeletonLine lines={3} /> : null}
        </div>
      )}
    </div>
  );
};

const AllDecisionsSuspense = ({
  initialData,
}: {
  initialData?: DecisionProfileListResponse;
}) => {
  return (
    <Tabs defaultSelectedKey="active">
      <TabList variant="pill" className="gap-4 border-none">
        <Tab id="active" variant="pill">
          Your active processes
        </Tab>
        <Tab id="other" variant="pill">
          Other processes
        </Tab>
      </TabList>
      <TabPanel id="active" className="p-0 sm:p-0">
        <DecisionsList
          status={ProcessStatus.PUBLISHED}
          initialData={initialData}
        />
      </TabPanel>
      <TabPanel id="other" className="p-0">
        <Suspense fallback={<SkeletonLine lines={5} />}>
          <DecisionsList status={ProcessStatus.COMPLETED} />
        </Suspense>
      </TabPanel>
    </Tabs>
  );
};

export const AllDecisions = ({
  initialData,
}: {
  initialData?: DecisionProfileListResponse;
}) => {
  return (
    <ErrorBoundary fallback={<div>Could not load decisions</div>}>
      <Suspense fallback={<SkeletonLine lines={5} />}>
        <AllDecisionsSuspense initialData={initialData} />
      </Suspense>
    </ErrorBoundary>
  );
};
