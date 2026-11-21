'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { DecisionAccess, InstancePhaseData } from '@op/api/encoders';
import { type ProcessCategory, nextCursor } from '@op/common/client';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense, useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { CategoryFilterSelect } from './CategoryFilterSelect';
import { ExportProposalsButton } from './ExportProposalsButton';
import {
  FilterBarActions,
  FilterBarEnd,
  FilterBarSearch,
  FilterBarSelect,
  FilterBarStart,
} from './FilterBar';
import {
  ProposalFilterBarSkeleton,
  ProposalListSkeleton,
} from './ProposalListSkeleton';
import {
  ProposalReviewProgressTable,
  ProposalReviewProgressTableSkeleton,
} from './ProposalReviewProgressTable';
import { ProposalsListHeader } from './ProposalsFilterBarParts';
import { NoProposalsFound } from './ProposalsGrid';
import {
  ProposalsList,
  type ProposalsLoaderRenderProps,
  useProposalsLoaderRenderProps,
} from './ProposalsList';
import { ProposalsLoadError } from './ProposalsLoadError';
import { StickyFilterBar } from './StickyFilterBar';
import {
  ProposalReviewDecorationProvider,
  useReportProposalsForReviewDecoration,
} from './proposalReviewDecoration';
import {
  ALL_REVIEW_STATUSES,
  type ReviewProposalFilterState,
  useReviewProposalFilters,
} from './useReviewProposalFilters';

interface ReviewAllProposalsListProps {
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

/** Owns its loading and error states, because it is the whole review surface for an admin who is not a reviewer. */
export function ReviewAllProposalsList({
  processInstanceId,
  slug,
  decisionSlug,
  access,
  currentPhase,
  canSeeReviewProgress,
  pinOffset,
}: ReviewAllProposalsListProps) {
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
        <Suspense fallback={<ReviewAllProposalsSkeleton />}>
          <ReviewAllProposalsLoader
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

function ReviewAllProposalsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <ProposalFilterBarSkeleton />
      <ProposalReviewProgressTableSkeleton />
    </div>
  );
}

interface ReviewAllProposalsLoaderProps {
  processInstanceId: string;
  decisionSlug: string;
  canExport: boolean;
  opensInSheet: boolean;
  pinOffset?: number;
}

function ReviewAllProposalsLoader(props: ReviewAllProposalsLoaderProps) {
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
        // A client-side fetch is what registers the invalidation channel.
        refetchOnMount: 'always',
      },
    );

  const allProposals = useMemo(
    () => paginatedData.pages.flatMap((page) => page.items),
    [paginatedData.pages],
  );

  const data = useProposalsLoaderRenderProps(
    allProposals,
    paginatedData.pages[0]?.total ?? 0,
    paginatedData.pages[0]?.unfilteredTotal ?? 0,
    query,
  );

  return (
    <ReviewAllProposalsContent
      {...props}
      {...data}
      filters={filters}
      categories={categories}
    />
  );
}

function ReviewAllProposalsContent({
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
}: ReviewAllProposalsLoaderProps &
  ProposalsLoaderRenderProps & {
    filters: ReviewProposalFilterState;
    categories: ProcessCategory[];
  }) {
  const t = useTranslations();
  const exportEnabled = useFeatureFlag('export-feature') ?? false;

  useReportProposalsForReviewDecoration(allProposals);

  return (
    <div
      aria-busy={filters.isFilterFetching || undefined}
      className="relative flex flex-col gap-6 pb-12"
    >
      <StickyFilterBar pinOffset={pinOffset}>
        <FilterBarStart>
          <ProposalsListHeader count={total} total={totalProposalCount} />
          <FilterBarSearch
            value={filters.search}
            onChange={filters.setSearch}
            isPending={filters.isSearchFetching}
            label={t('decisions.proposals.searchProposalsLabel')}
          />
        </FilterBarStart>
        <FilterBarEnd>
          <CategoryFilterSelect
            decisionSlug={decisionSlug}
            categories={categories}
            selectedCategory={filters.selectedCategory}
            onSelectCategory={filters.setSelectedCategory}
          />
          <FilterBarSelect
            value={filters.reviewStatus}
            onChange={filters.setReviewStatus}
            label={t('decisions.review.filterByReviewStatusLabel')}
            items={[
              {
                id: ALL_REVIEW_STATUSES,
                label: t('decisions.review.allStatusesOption'),
              },
              {
                id: 'unassigned',
                label: t('decisions.review.reviewStatusUnassignedOption'),
              },
              {
                id: 'none',
                label: t('decisions.review.reviewStatusNoneOption'),
              },
              { id: 'partial', label: t('In progress') },
              {
                id: 'reviewed',
                label: t('decisions.review.reviewStatusReviewedOption'),
              },
              {
                id: 'outOfDate',
                label: t('decisions.review.reviewStatusOutOfDateOption'),
              },
            ]}
          />
          <FilterBarSelect
            label={t('decisions.proposals.sortProposalsLabel')}
            value={filters.sortOrder}
            onChange={filters.setSortOrder}
            items={[
              {
                id: 'newest',
                label: t('decisions.proposals.sortNewestOption'),
              },
              {
                id: 'fewestReviews',
                label: t('decisions.review.sortFewestReviews'),
              },
              {
                id: 'mostReviews',
                label: t('decisions.review.sortMostReviews'),
              },
            ]}
          />
          {canExport && exportEnabled && (
            <FilterBarActions>
              <ExportProposalsButton
                processInstanceId={processInstanceId}
                isListEmpty={totalProposalCount === 0}
              />
            </FilterBarActions>
          )}
        </FilterBarEnd>
      </StickyFilterBar>

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
