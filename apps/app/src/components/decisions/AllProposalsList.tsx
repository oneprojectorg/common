'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import type { RouterOutput } from '@op/api';
import { trpc } from '@op/api/client';
import type { DecisionAccess, InstancePhaseData } from '@op/api/encoders';
import { nextCursor } from '@op/common/client';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense, useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ExportProposalsButton } from './ExportProposalsButton';
import {
  ProposalFilterBarSkeleton,
  ProposalListSkeleton,
} from './ProposalListSkeleton';
import {
  ProposalReviewProgressTable,
  ProposalReviewProgressTableSkeleton,
} from './ProposalReviewProgressTable';
import type { ProposalControls } from './ProposalsFilterBar';
import { NoProposalsFound } from './ProposalsGrid';
import {
  ProposalsList,
  type ProposalsLoaderRenderProps,
  useProposalsLoaderRenderProps,
} from './ProposalsList';
import { ProposalsLoadError } from './ProposalsLoadError';
import { ProposalsStickyFilterBar } from './ProposalsStickyFilterBar';
import {
  ProposalReviewDecorationProvider,
  useReportProposalsForReviewDecoration,
} from './proposalReviewDecoration';
import {
  type ReviewProposalFilterState,
  useReviewProposalFilters,
} from './useReviewProposalFilters';

type Category = RouterOutput['decision']['getCategories']['items'][number];

interface AllProposalsListProps {
  processInstanceId: string;
  slug: string;
  /** Decision profile slug — the per-proposal reviews link is built from it. */
  decisionSlug: string;
  access?: DecisionAccess;
  currentPhase: InstancePhaseData;
  /** Whether this viewer may see review progress; without it the list is plain cards. */
  canSeeReviewProgress: boolean;
  /** Px offset where the filter bar pins (clears the floating phase toggle). */
  pinOffset?: number;
}

/**
 * The review page's "All proposals" surface: the review progress table over
 * `decision.listReviewProposals`, filterable by category and sortable by review
 * count. A viewer who may not see review progress gets the plain proposals
 * list.
 *
 * This is the whole review surface for an admin who is not also a reviewer —
 * there is no assignment queue to tab against, so the list owns its own
 * loading and error states rather than leaning on the page's.
 */
export function AllProposalsList({
  processInstanceId,
  slug,
  decisionSlug,
  access,
  currentPhase,
  canSeeReviewProgress,
  pinOffset,
}: AllProposalsListProps) {
  if (!canSeeReviewProgress) {
    return (
      <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
        <Suspense fallback={<ProposalListSkeleton />}>
          <ProposalsList
            slug={slug}
            instanceId={processInstanceId}
            decisionSlug={decisionSlug}
            permissions={access}
            currentPhase={currentPhase}
            pinOffset={pinOffset}
          />
        </Suspense>
      </APIErrorBoundary>
    );
  }

  return (
    <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
      {/* Outside the Suspense boundary so the reported-proposals state survives
          a re-suspend (a filter change refetches the list, not the aggregates
          the provider already holds). */}
      <ProposalReviewDecorationProvider
        processInstanceId={processInstanceId}
        decisionSlug={decisionSlug}
        phaseId={currentPhase.phaseId}
        enabled
        canOpenReviews
      >
        <Suspense fallback={<AllProposalsSkeleton />}>
          <AllProposalsLoader
            processInstanceId={processInstanceId}
            decisionSlug={decisionSlug}
            canExport={Boolean(access?.admin)}
            opensInSheet={Boolean(access?.admin)}
            pinOffset={pinOffset}
          />
        </Suspense>
      </ProposalReviewDecorationProvider>
    </APIErrorBoundary>
  );
}

function AllProposalsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <ProposalFilterBarSkeleton />
      <ProposalReviewProgressTableSkeleton />
    </div>
  );
}

interface AllProposalsLoaderProps {
  processInstanceId: string;
  decisionSlug: string;
  canExport: boolean;
  opensInSheet: boolean;
  pinOffset?: number;
}

function AllProposalsLoader(props: AllProposalsLoaderProps) {
  const [{ items: categories }] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId: props.processInstanceId,
  });
  const filters = useReviewProposalFilters({
    processInstanceId: props.processInstanceId,
    categoryIds: useMemo(
      () => new Set(categories.map((category) => category.id)),
      [categories],
    ),
  });

  const [paginatedData, query] =
    trpc.decision.listReviewProposals.useSuspenseInfiniteQuery(
      filters.queryParams,
      {
        getNextPageParam: nextCursor,
        staleTime: 30 * 1000,
        // Force a client-side fetch so the query registers its invalidation
        // channel via the client link, as `proposal.list` does.
        refetchOnMount: 'always',
      },
    );
  // Unfiltered count for the "of N" denominator; only `.total` is read.
  const [unfilteredData] = trpc.decision.listReviewProposals.useSuspenseQuery(
    { processInstanceId: props.processInstanceId, limit: 1 },
    { staleTime: 30 * 1000 },
  );

  const allProposals = useMemo(
    () => paginatedData.pages.flatMap((page) => page.items),
    [paginatedData.pages],
  );

  const data = useProposalsLoaderRenderProps(
    allProposals,
    paginatedData.pages[0]?.total ?? 0,
    unfilteredData.total,
    query,
  );

  return (
    <AllProposalsContent
      {...props}
      {...data}
      filters={filters}
      categories={categories}
    />
  );
}

function AllProposalsContent({
  processInstanceId,
  decisionSlug,
  canExport,
  opensInSheet,
  pinOffset,
  filters,
  categories,
  allProposals,
  total,
  totalProposalCount,
  isFetchingNextPage,
  shouldShowTrigger,
  infiniteScrollRef,
}: AllProposalsLoaderProps &
  ProposalsLoaderRenderProps & {
    filters: ReviewProposalFilterState;
    categories: Category[];
  }) {
  const t = useTranslations();
  const exportEnabled = useFeatureFlag('export-feature') ?? false;

  useReportProposalsForReviewDecoration(allProposals);

  const controls: ProposalControls = {
    search: filters.search,
    setSearch: filters.setSearch,
    isSearchPending: filters.isSearchFetching,
    selectedCategory: filters.selectedCategory,
    setSelectedCategory: filters.setSelectedCategory,
    sortOrder: filters.sortOrder,
    setSortOrder: filters.setSortOrder,
    sortOptions: [
      { id: 'newest', label: t('decisions.proposals.sortNewestOption') },
      { id: 'fewestReviews', label: t('decisions.review.sortFewestReviews') },
      { id: 'mostReviews', label: t('decisions.review.sortMostReviews') },
    ],
    categories,
    decisionSlug,
  };

  return (
    <div
      aria-busy={filters.isFilterFetching || undefined}
      className="relative flex flex-col gap-6 pb-12"
    >
      <ProposalsStickyFilterBar
        pinOffset={pinOffset}
        count={total}
        total={totalProposalCount}
        controls={controls}
        exportControl={
          canExport && exportEnabled ? (
            <ExportProposalsButton
              processInstanceId={processInstanceId}
              isListEmpty={totalProposalCount === 0}
            />
          ) : null
        }
      />

      {allProposals.length === 0 ? (
        <NoProposalsFound
          hasFilter={filters.hasActiveFilter}
          searchQuery={filters.queryParams.search}
          onClearFilters={
            filters.hasActiveFilter ? filters.clearFilters : undefined
          }
        />
      ) : (
        <ProposalReviewProgressTable
          proposals={allProposals}
          decisionSlug={decisionSlug}
          opensInSheet={opensInSheet}
        />
      )}

      {shouldShowTrigger ? (
        <div
          ref={infiniteScrollRef}
          className="py-4"
          data-testid="proposals-infinite-scroll-sentinel"
        >
          {isFetchingNextPage ? <Skeleton className="h-16 w-full" /> : null}
        </div>
      ) : null}
    </div>
  );
}
