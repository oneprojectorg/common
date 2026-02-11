'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { DecisionProfileList, ProcessStatus } from '@op/api/encoders';
import { useInfiniteScroll } from '@op/hooks';
import { SkeletonLine } from '@op/ui/Skeleton';
import { Tab, TabList, TabPanel, Tabs } from '@op/ui/Tabs';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';

import { DecisionListItem } from '../DecisionListItem';

const DecisionsListSuspense = ({
  status,
  initialData,
  ownerProfileId,
}: {
  status: ProcessStatus;
  initialData?: DecisionProfileList;
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
          {isFetchingNextPage ? <SkeletonLine lines={3} /> : null}
        </div>
      )}
    </div>
  );
};

const AllDecisionsTabs = ({
  initialData,
}: {
  initialData?: DecisionProfileList;
}) => {
  const t = useTranslations();
  const { user } = useUser();
  const ownerProfileId = user.currentProfile?.id;

  const [draftsCheck] = trpc.decision.listDecisionProfiles.useSuspenseQuery({
    limit: 1,
    status: ProcessStatus.DRAFT,
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
        <Suspense fallback={<SkeletonLine lines={5} />}>
          <DecisionsListSuspense
            status={ProcessStatus.PUBLISHED}
            initialData={initialData}
          />
        </Suspense>
      </TabPanel>
      {hasDrafts && (
        <TabPanel id="drafts" className="p-0 sm:p-0">
          <Suspense fallback={<SkeletonLine lines={5} />}>
            <DecisionsListSuspense
              status={ProcessStatus.DRAFT}
              ownerProfileId={ownerProfileId}
            />
          </Suspense>
        </TabPanel>
      )}
      <TabPanel id="other" className="p-0 sm:p-0">
        <Suspense fallback={<SkeletonLine lines={5} />}>
          <DecisionsListSuspense status={ProcessStatus.COMPLETED} />
        </Suspense>
      </TabPanel>
    </Tabs>
  );
};

export const AllDecisions = ({
  initialData,
}: {
  initialData?: DecisionProfileList;
}) => {
  const { user } = useUser();

  return (
    <ErrorBoundary fallback={<div>Could not load decisions</div>}>
      <Suspense fallback={<SkeletonLine lines={5} />}>
        <AllDecisionsTabs
          key={user.currentProfile?.id}
          initialData={initialData}
        />
      </Suspense>
    </ErrorBoundary>
  );
};
