'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { trpc } from '@op/api/client';
import type { DecisionAccess } from '@op/api/encoders';
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

interface AdminReviewProposalsListProps {
  processInstanceId: string;
  /** Decision profile slug — the per-proposal reviews link is built from it. */
  decisionSlug: string;
  access?: DecisionAccess;
  /** Px offset where the filter bar pins (clears the floating phase toggle). */
  pinOffset?: number;
}

/**
 * The admin's "All proposals" surface: the review progress table over the
 * same paginated, filtered `proposal.list` every other proposal screen uses.
 *
 * This is the whole review surface for an admin who is not also a reviewer —
 * there is no assignment queue to tab against, so the list owns its own
 * loading and error states rather than leaning on the page's.
 */
export function AdminReviewProposalsList({
  processInstanceId,
  decisionSlug,
  access,
  pinOffset,
}: AdminReviewProposalsListProps) {
  const isAdmin = Boolean(access?.admin);

  return (
    <APIErrorBoundary fallbacks={{ default: () => <ProposalsLoadError /> }}>
      {/* Outside the Suspense boundary so the reported-proposals state survives
          a re-suspend (a filter change refetches the list, not the aggregates
          the provider already holds). The gate is this surface's: an admin
          needs no `openReviews` to track progress. */}
      <ProposalReviewDecorationProvider
        processInstanceId={processInstanceId}
        decisionSlug={decisionSlug}
        enabled={isAdmin}
        canOpenReviews={isAdmin}
      >
        <Suspense fallback={<ProposalListSkeleton />}>
          <AdminReviewProposalsLoader
            processInstanceId={processInstanceId}
            decisionSlug={decisionSlug}
            canExport={isAdmin}
            pinOffset={pinOffset}
          />
        </Suspense>
      </ProposalReviewDecorationProvider>
    </APIErrorBoundary>
  );
}

interface AdminReviewProposalsLoaderProps {
  processInstanceId: string;
  decisionSlug: string;
  canExport: boolean;
  pinOffset?: number;
}

function AdminReviewProposalsLoader(props: AdminReviewProposalsLoaderProps) {
  const filters = useProposalFilters({ instanceId: props.processInstanceId });

  return (
    <CurrentPhaseProposalsLoader queryParams={filters.queryParams}>
      {(data) => (
        <AdminReviewProposalsContent {...props} {...data} filters={filters} />
      )}
    </CurrentPhaseProposalsLoader>
  );
}

function AdminReviewProposalsContent({
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
}: AdminReviewProposalsLoaderProps &
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
