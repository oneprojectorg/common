'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { match } from '@op/core';
import { useInfiniteScroll } from '@op/hooks';
import { Skeleton } from '@op/sense/Skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@op/sense/Tabs';
import { useQueryState } from 'nuqs';
import { Fragment, Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import ErrorBoundary from '@/components/ErrorBoundary';
import { TranslatedText } from '@/components/TranslatedText';

import { DecisionListItem } from '../DecisionListItem';

const DecisionListItemSkeleton = () => (
  <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between sm:rounded-none sm:border-0">
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
  <div className="flex flex-col gap-4">
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
  const t = useTranslations();
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
      <div className="py-8 text-center text-muted-foreground">
        {t('No processes found')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {paginatedItems.map((item, index) => (
        <Fragment key={item.id}>
          <DecisionListItem item={item} />
          {index < paginatedItems.length - 1 && (
            <hr className="hidden sm:block" />
          )}
        </Fragment>
      ))}
      {shouldShowTrigger && (
        <div ref={ref} className="flex justify-center py-4">
          {isFetchingNextPage ? <DecisionListItemSkeleton /> : null}
        </div>
      )}
    </div>
  );
};

const AllDecisionsTabs = () => {
  const t = useTranslations();
  const { user } = useRequiredUser();
  const [tab, setTab] = useQueryState('tab');
  const ownerProfileId = user.currentProfile?.id;

  const [draftsCheck] = trpc.decision.listDecisionProfiles.useSuspenseQuery({
    limit: 1,
    status: [ProcessStatus.DRAFT],
    ownerProfileId,
  });

  const hasDrafts = draftsCheck.items.length > 0;
  const selectedTab = match(tab, {
    drafts: () => (hasDrafts ? 'drafts' : 'active'),
    completed: 'completed',
    _: 'active',
  });

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => {
        setTab(value === 'active' ? null : value);
      }}
      className="gap-4"
    >
      <div className="border-b">
        <TabsList variant="line">
          <TabsTrigger value="active">{t('Active')}</TabsTrigger>
          <TabsTrigger value="completed">{t('Completed')}</TabsTrigger>
          {hasDrafts && <TabsTrigger value="drafts">{t('Drafts')}</TabsTrigger>}
        </TabsList>
      </div>
      <TabsContent value="active">
        <Suspense fallback={<DecisionsListSkeleton />}>
          <DecisionsListSuspense status={[ProcessStatus.PUBLISHED]} />
        </Suspense>
      </TabsContent>
      <TabsContent value="completed">
        <Suspense fallback={<DecisionsListSkeleton />}>
          <DecisionsListSuspense status={[ProcessStatus.COMPLETED]} />
        </Suspense>
      </TabsContent>
      {hasDrafts && (
        <TabsContent value="drafts">
          <Suspense fallback={<DecisionsListSkeleton />}>
            <DecisionsListSuspense
              status={[ProcessStatus.DRAFT]}
              ownerProfileId={ownerProfileId}
            />
          </Suspense>
        </TabsContent>
      )}
    </Tabs>
  );
};

export const AllDecisions = () => {
  const { user } = useRequiredUser();

  return (
    <ErrorBoundary
      fallback={
        <div>
          <TranslatedText text="Could not load decisions" />
        </div>
      }
    >
      <Suspense fallback={<DecisionsListSkeleton />}>
        <AllDecisionsTabs key={user.currentProfile?.id} />
      </Suspense>
    </ErrorBoundary>
  );
};
