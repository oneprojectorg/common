'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { DecisionAccess, InstancePhaseData } from '@op/api/encoders';
import { Skeleton } from '@op/sense/Skeleton';
import { Suspense } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ExportProposalsButton } from './ExportProposalsButton';
import { ProposalListSkeleton } from './ProposalListSkeleton';
import { ProposalReviewProgressTable } from './ProposalReviewProgressTable';
import type {
  ProposalControls,
  ProposalSelectControl,
} from './ProposalsFilterBar';
import { NoProposalsFound } from './ProposalsGrid';
import {
  CurrentPhaseProposalsLoader,
  ProposalsList,
  type ProposalsLoaderRenderProps,
} from './ProposalsList';
import { ProposalsLoadError } from './ProposalsLoadError';
import { ProposalsStickyFilterBar } from './ProposalsStickyFilterBar';
import {
  ProposalReviewDecorationProvider,
  useReportProposalsForReviewDecoration,
} from './proposalReviewDecoration';
import {
  type ProposalFilterState,
  useProposalFilters,
} from './useProposalFilters';

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
 * the same paginated, filtered `proposal.list` every other proposal screen
 * uses. A viewer who may not see review progress gets the plain proposals list.
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
        <Suspense fallback={<ProposalListSkeleton />}>
          <AllProposalsLoader
            processInstanceId={processInstanceId}
            decisionSlug={decisionSlug}
            canExport={Boolean(access?.admin)}
            pinOffset={pinOffset}
          />
        </Suspense>
      </ProposalReviewDecorationProvider>
    </APIErrorBoundary>
  );
}

interface AllProposalsLoaderProps {
  processInstanceId: string;
  decisionSlug: string;
  canExport: boolean;
  pinOffset?: number;
}

function AllProposalsLoader(props: AllProposalsLoaderProps) {
  const filters = useProposalFilters({ instanceId: props.processInstanceId });

  return (
    <CurrentPhaseProposalsLoader queryParams={filters.queryParams}>
      {(data) => <AllProposalsContent {...props} {...data} filters={filters} />}
    </CurrentPhaseProposalsLoader>
  );
}

function AllProposalsContent({
  processInstanceId,
  decisionSlug,
  canExport,
  pinOffset,
  filters,
  allProposals,
  total,
  totalProposalCount,
  isFetchingNextPage,
  shouldShowTrigger,
  infiniteScrollRef,
}: AllProposalsLoaderProps &
  ProposalsLoaderRenderProps & { filters: ProposalFilterState }) {
  const t = useTranslations();
  const [{ items: categories }] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId,
  });
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
    categories,
    decisionSlug,
  };

  const leadingSelect: ProposalSelectControl = {
    items: filters.availableFilters,
    value: filters.proposalFilter,
    onChange: (id) => {
      const selected = filters.availableFilters.find((item) => item.id === id);
      if (selected) {
        filters.setProposalFilter(selected.id);
      }
    },
    label: t('decisions.proposals.filterProposalsLabel'),
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
        leadingSelect={leadingSelect}
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
            filters.canClearFilters ? filters.clearFilters : undefined
          }
        />
      ) : (
        <ProposalReviewProgressTable
          proposals={allProposals}
          decisionSlug={decisionSlug}
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
