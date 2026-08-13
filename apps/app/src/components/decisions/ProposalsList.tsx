'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { APIErrorBoundary } from '@/utils/APIErrorBoundary';
import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  type DecisionAccess,
  type InstancePhaseData,
  ProposalFilter,
  ProposalStatus,
} from '@op/api/encoders';
import {
  type Proposal,
  ProposalReviewRequestState,
  isReviewPhase,
  isVotingPhase,
} from '@op/common/client';
import { useDebounce, useInfiniteScroll } from '@op/hooks';
import { cn } from '@op/sense/lib/utils';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import {
  type ReactNode,
  type RefCallback,
  Suspense,
  useCallback,
  useDeferredValue,
  useMemo,
} from 'react';

import { useTranslations } from '@/lib/i18n';

import { ExportProposalsButton } from './ExportProposalsButton';
import { MobileViewSwitch } from './MobileViewSwitch';
import { ProposalBrowseCard } from './ProposalBrowseCard';
import {
  ProposalCardSkeleton,
  ProposalListSkeletonGrid,
} from './ProposalListSkeleton';
import { ProposalTranslationProvider } from './ProposalTranslationContext';
import type { ProposalControls } from './ProposalsFilterBar';
import { ProposalsGrid } from './ProposalsGrid';
import {
  ProposalsMapView,
  ProposalsMapWithLocations,
} from './ProposalsMapView';
import { ProposalsStickyFilterBar } from './ProposalsStickyFilterBar';
import { TranslateBanner } from './TranslateBanner';
import {
  useDecisionNeedsTranslation,
  useRegisterTranslationSamples,
} from './TranslationDetectionContext';
import { TranslationNotice } from './TranslationNotice';
import { proposalHref } from './proposalHrefs';
import { useReportProposalsForReviewDecoration } from './proposalReviewDecoration';
import { getProposalDetectionText } from './translationDetectionText';
import { useProposalViewMode } from './useProposalViewMode';
import { useTranslateDecision } from './useTranslateDecision';

export interface ProposalsListProps {
  slug: string;
  instanceId: string;
  /** Decision profile slug for building proposal links */
  decisionSlug?: string;
  /** Decision profile ID for translating the decision content */
  decisionProfileId?: string | null;
  /** Role-based capabilities for the current user. */
  permissions?: DecisionAccess | null;
  /** Override the default proposal filter */
  initialFilter?: ProposalFilter;
  /** When set to 'results', all proposals are returned as non-editable */
  phase?: 'results';
  /** Current phase; capability flags are derived from `rules`. */
  currentPhase?: InstancePhaseData;
  /** When true, new proposals are hidden by default in the current phase. */
  proposalsHidden?: boolean;
  /** Exclude proposals the current user is assigned to review (Other proposals tab). */
  excludeAssignedForReview?: boolean;
  /**
   * Replaces the "N proposals" count in the filter bar; receives the count for
   * the active filter. The admin review surface titles itself
   * "Proposals in review · N".
   */
  header?: (count: number) => ReactNode;
  /**
   * Px offset where the sticky filter bar pins. Decision-view passes a larger
   * value to clear the Overview/Current toggle; other routes use the default.
   */
  pinOffset?: number;
}

// A multiple of three so a full page fills the three-per-row grid evenly.
// Kept small — every server-side cost of listProposals scales with this
// number, and infinite scroll pulls further pages as needed.
const PROPOSALS_PAGE_LIMIT = 24;

const PROPOSAL_FILTER_VALUES = Object.values(ProposalFilter);

const SEARCH_DEBOUNCE_MS = 300;

type ProposalQueryParams = {
  processInstanceId: string;
  categoryId?: string;
  search?: string;
  submittedByProfileId?: string;
  votedByProfileId?: string;
  status?: ProposalStatus;
  dir: 'asc' | 'desc';
  limit: number;
  phase?: 'results';
  excludeAssignedForReview?: boolean;
};

type ProposalsLoaderRenderProps = {
  allProposals: Proposal[];
  /** Full server-side proposal count for the active filter, independent of how many pages are loaded. */
  total: number;
  /** Unfiltered proposal count for the phase — the "of N" pool, counted by the same query as `total`. */
  totalProposalCount: number;
  isFetchingNextPage: boolean;
  shouldShowTrigger: boolean;
  infiniteScrollRef: RefCallback<HTMLDivElement>;
};

const useProposalsLoaderRenderProps = (
  allProposals: Proposal[],
  total: number,
  totalProposalCount: number,
  {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  }: {
    fetchNextPage: () => unknown;
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
  },
): ProposalsLoaderRenderProps => {
  const stableFetchNextPage = useCallback(() => {
    fetchNextPage();
  }, [fetchNextPage]);

  const { ref, shouldShowTrigger } = useInfiniteScroll<HTMLDivElement>(
    stableFetchNextPage,
    {
      hasNextPage,
      isFetchingNextPage,
      threshold: 0.1,
      rootMargin: '50px',
    },
  );

  return {
    allProposals,
    total,
    totalProposalCount,
    isFetchingNextPage,
    shouldShowTrigger,
    infiniteScrollRef: ref,
  };
};

const CurrentPhaseProposalsLoader = ({
  queryParams,
  children,
}: {
  queryParams: ProposalQueryParams;
  children: (data: ProposalsLoaderRenderProps) => React.ReactNode;
}) => {
  const [paginatedData, query] =
    trpc.decision.listProposals.useSuspenseInfiniteQuery(queryParams, {
      getNextPageParam: (lastPage) => lastPage.next ?? undefined,
      staleTime: 30 * 1000,
      // Force a client-side fetch so the query registers its invalidation
      // channel via the client link. TODO: find a cleaner way to register.
      refetchOnMount: 'always',
    });

  // Unfiltered count for the "of N" denominator — same endpoint/visibility as
  // the list, so it matches `total` when no filter is active. Only `.total` is
  // used, so a single row is fetched.
  const [unfilteredData] = trpc.decision.listProposals.useSuspenseQuery(
    {
      processInstanceId: queryParams.processInstanceId,
      dir: queryParams.dir,
      limit: 1,
      phase: queryParams.phase,
      excludeAssignedForReview: queryParams.excludeAssignedForReview,
    },
    { staleTime: 30 * 1000 },
  );

  const allProposals = useMemo(
    () => paginatedData.pages.flatMap((page) => page.proposals),
    [paginatedData.pages],
  );
  const total = paginatedData.pages[0]?.total ?? 0;

  return children(
    useProposalsLoaderRenderProps(
      allProposals,
      total,
      unfilteredData.total,
      query,
    ),
  );
};

const ResultsPhaseProposalsLoader = ({
  queryParams,
  children,
}: {
  queryParams: ProposalQueryParams;
  children: (data: ProposalsLoaderRenderProps) => React.ReactNode;
}) => {
  const [paginatedData, query] =
    trpc.decision.listAllProposals.useSuspenseInfiniteQuery(
      {
        processInstanceId: queryParams.processInstanceId,
        dir: queryParams.dir,
        limit: queryParams.limit,
        categoryId: queryParams.categoryId,
        status: queryParams.status,
        submittedByProfileId: queryParams.submittedByProfileId,
        votedByProfileId: queryParams.votedByProfileId,
      },
      {
        getNextPageParam: (lastPage) => lastPage.next ?? undefined,
        staleTime: 30 * 1000,
        refetchOnMount: 'always',
      },
    );

  // Unfiltered count for the "of N" denominator — same endpoint as the list so
  // it matches `total` when no filter is active. Only `.total` is used.
  const [unfilteredData] = trpc.decision.listAllProposals.useSuspenseQuery({
    processInstanceId: queryParams.processInstanceId,
    dir: queryParams.dir,
    limit: 1,
  });

  const allProposals = useMemo(
    () => paginatedData.pages.flatMap((page) => page.items),
    [paginatedData.pages],
  );
  const total = paginatedData.pages[0]?.total ?? 0;

  return children(
    useProposalsLoaderRenderProps(
      allProposals,
      total,
      unfilteredData.total,
      query,
    ),
  );
};

// fallow-ignore-next-line complexity
export const ProposalsList = (props: ProposalsListProps) => {
  const { instanceId, phase, initialFilter, excludeAssignedForReview } = props;

  const { user } = useUser();
  const currentProfileId = user?.currentProfile?.id;

  const [voteStatus] = trpc.decision.getVotingStatus.useSuspenseQuery({
    processInstanceId: instanceId,
  });
  const hasVoted = voteStatus?.hasVoted || false;

  // nuqs holds the filters in the URL. `filter` has no default so an absent
  // value can fall back to the ballot-aware default derived below.
  const [selectedCategory, setSelectedCategory] = useQueryState(
    'category',
    parseAsString.withDefault('all-categories'),
  );
  const [sortOrder, setSortOrder] = useQueryState(
    'sort',
    parseAsString.withDefault('newest'),
  );
  // Every keystroke, but nuqs replaces rather than pushes — no history spam.
  const [search, setSearch] = useQueryState('q', parseAsString.withDefault(''));
  const [debouncedSearch] = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);
  const [filterParam, setProposalFilter] = useQueryState(
    'filter',
    parseAsStringLiteral(PROPOSAL_FILTER_VALUES),
  );
  const requestedFilter =
    filterParam ??
    initialFilter ??
    (hasVoted ? ProposalFilter.MY_BALLOT : ProposalFilter.ALL);
  // "My proposals"/"My ballot" need a profile; for anonymous/stale-link visitors
  // fall back to ALL so the label can't claim a filter the query didn't apply.
  const requiresProfile =
    requestedFilter === ProposalFilter.MY_PROPOSALS ||
    requestedFilter === ProposalFilter.MY_BALLOT;
  const proposalFilter =
    requiresProfile && !currentProfileId ? ProposalFilter.ALL : requestedFilter;

  // Deferred so a filter change is non-urgent: the suspense boundary wraps all
  // of ProposalsList, so an urgent update would swap the bar (and whatever has
  // focus) for a skeleton. One primitive per call — `useDeferredValue` compares
  // with `Object.is`, so a `{ ... }` snapshot would never settle.
  const appliedSearch = useDeferredValue(debouncedSearch);
  const appliedCategory = useDeferredValue(selectedCategory);
  const appliedSortOrder = useDeferredValue(sortOrder);
  const appliedFilter = useDeferredValue(proposalFilter);

  // Against the debounced term, not the raw field: otherwise the spinner lights
  // on the first keystroke and holds through the debounce.
  const isSearchFetching = appliedSearch !== debouncedSearch;
  const isFilterFetching =
    isSearchFetching ||
    appliedCategory !== selectedCategory ||
    appliedSortOrder !== sortOrder ||
    appliedFilter !== proposalFilter;

  const queryParams = useMemo<ProposalQueryParams>(() => {
    const params: ProposalQueryParams = {
      processInstanceId: instanceId,
      dir: appliedSortOrder === 'newest' ? 'desc' : 'asc',
      limit: PROPOSALS_PAGE_LIMIT,
      phase,
      excludeAssignedForReview,
    };

    if (appliedCategory !== 'all-categories') {
      params.categoryId = appliedCategory;
    }

    // Blank is omitted to keep the untouched query key. `listAllProposals`
    // (results phase) has no search support and would silently drop the term.
    if (appliedSearch && phase !== 'results') {
      params.search = appliedSearch;
    }

    // Filter in SQL so pagination and the total count stay accurate per filter.
    if (appliedFilter === ProposalFilter.MY_PROPOSALS && currentProfileId) {
      params.submittedByProfileId = currentProfileId;
    } else if (appliedFilter === ProposalFilter.MY_BALLOT && currentProfileId) {
      params.votedByProfileId = currentProfileId;
    }

    return params;
  }, [
    instanceId,
    appliedCategory,
    appliedSearch,
    appliedSortOrder,
    phase,
    appliedFilter,
    currentProfileId,
    excludeAssignedForReview,
  ]);

  // Applied, not live: reading the controls would flash "no proposals yet" for a
  // frame when clearing a filter that had returned nothing. Via `queryParams` so
  // the search half keeps the results-phase gate.
  const hasActiveFilter =
    !!queryParams.search ||
    appliedCategory !== 'all-categories' ||
    appliedFilter !== ProposalFilter.ALL;

  const renderContent = (data: ProposalsLoaderRenderProps) => (
    <ProposalsListContent
      {...props}
      {...data}
      queryParams={queryParams}
      proposalFilter={proposalFilter}
      setProposalFilter={setProposalFilter}
      selectedCategory={selectedCategory}
      setSelectedCategory={setSelectedCategory}
      sortOrder={sortOrder}
      setSortOrder={setSortOrder}
      search={search}
      setSearch={setSearch}
      isSearchFetching={isSearchFetching}
      isFilterFetching={isFilterFetching}
      hasActiveFilter={hasActiveFilter}
    />
  );

  if (phase === 'results') {
    return (
      <ResultsPhaseProposalsLoader queryParams={queryParams}>
        {renderContent}
      </ResultsPhaseProposalsLoader>
    );
  }

  return (
    <CurrentPhaseProposalsLoader queryParams={queryParams}>
      {renderContent}
    </CurrentPhaseProposalsLoader>
  );
};

// TODO: trim props — move filter state to a shared nuqs hook + extract an export button (follow-up).
type ProposalsListContentProps = ProposalsListProps &
  ProposalsLoaderRenderProps & {
    queryParams: ProposalQueryParams;
    proposalFilter: ProposalFilter;
    setProposalFilter: (filter: ProposalFilter) => void;
    selectedCategory: string;
    setSelectedCategory: (value: string) => void;
    sortOrder: string;
    setSortOrder: (value: string) => void;
    search: string;
    setSearch: (value: string) => void;
    isSearchFetching: boolean;
    isFilterFetching: boolean;
    /** Derived from the applied filters, so it matches the visible results. */
    hasActiveFilter: boolean;
  };

// fallow-ignore-next-line complexity
const ProposalsListContent = ({
  slug,
  instanceId,
  decisionSlug,
  decisionProfileId,
  permissions,
  currentPhase,
  proposalsHidden,
  excludeAssignedForReview,
  header,
  pinOffset,
  phase,
  queryParams,
  allProposals,
  total,
  totalProposalCount,
  isFetchingNextPage,
  shouldShowTrigger,
  infiniteScrollRef,
  proposalFilter,
  setProposalFilter,
  selectedCategory,
  setSelectedCategory,
  sortOrder,
  setSortOrder,
  search,
  setSearch,
  isSearchFetching,
  isFilterFetching,
  hasActiveFilter,
}: ProposalsListContentProps) => {
  const isInReviewPhase = !!currentPhase && isReviewPhase(currentPhase);
  const isInVotingPhase = !!currentPhase && isVotingPhase(currentPhase);
  const t = useTranslations();
  const { user } = useUser();

  const currentProfileId = user?.currentProfile?.id;
  const [[categoriesData, voteStatus, instance]] = trpc.useSuspenseQueries(
    (t) => [
      t.decision.getCategories({
        processInstanceId: instanceId,
      }),
      t.decision.getVotingStatus({
        processInstanceId: instanceId,
      }),
      t.decision.getInstance({ instanceId }),
    ],
  );

  const categories = categoriesData.categories;

  // Map browse mode is offered only when the process collects a location and
  // the GIS flag is on. Browse leads with the map when the process has one —
  // users came here to see places, not titles.
  const {
    hasLocationField,
    mapView,
    effectiveView,
    isMapMode,
    handleViewChange,
  } = useProposalViewMode(instance.instanceData?.proposalTemplate, {
    defaultView: 'map',
  });

  const hasVoted = voteStatus?.hasVoted || false;
  const selectedProposalIds =
    voteStatus?.voteSubmission?.selectedProposalIds || [];

  const canManageProposals = permissions?.admin ?? false;

  // CSV export is behind a flag for staged rollout. Defaulted rather than left
  // as `boolean | undefined` so the control stays hidden while flags load
  // instead of appearing and then vanishing.
  const exportEnabled = useFeatureFlag('export-feature') ?? false;
  const canExportProposals = canManageProposals && exportEnabled;

  const { data: revisionRequestsData } =
    trpc.decision.listProposalsRevisionRequests.useQuery(
      { states: [ProposalReviewRequestState.REQUESTED] },
      { enabled: isInReviewPhase },
    );

  const revisionRequestIdByProposalId = useMemo(
    () =>
      new Map<string, string>(
        revisionRequestsData?.revisionRequests.map(
          ({ proposal, revisionRequest }) => [proposal.id, revisionRequest.id],
        ),
      ),
    [revisionRequestsData],
  );

  // A review surface wraps this list in a decoration provider and needs the ids
  // the list has loaded; everywhere else there is no provider and this is inert.
  useReportProposalsForReviewDecoration(allProposals);

  const hrefFor = useCallback(
    (proposal: Proposal) =>
      proposalHref({
        profileId: proposal.profileId,
        decisionSlug,
        slug,
        instanceId,
      }),
    [decisionSlug, slug, instanceId],
  );

  // `useCallback` is load-bearing: the map view's list rows are memoized on
  // this function, so a fresh one every render would re-render the whole
  // column on each hover.
  const renderCard = useCallback(
    (proposal: Proposal, { className }: { className: string }) => (
      <ProposalBrowseCard
        proposal={proposal}
        instanceId={instanceId}
        slug={slug}
        decisionSlug={decisionSlug}
        permissions={permissions}
        revisionRequestId={revisionRequestIdByProposalId.get(proposal.id)}
        className={className}
      />
    ),
    [
      instanceId,
      slug,
      decisionSlug,
      permissions,
      revisionRequestIdByProposalId,
    ],
  );

  // Detect per proposal (not one concatenated sample) so proposals that
  // paginate in later are each checked — the badge can appear once a
  // different-language proposal loads further down the list.
  //
  // The phase copy is sampled alongside them because this list owns the only
  // trigger that translates it (`translateDecision` supplies the headline,
  // phase description and additionalInfo the phase pages render). Sampling
  // proposals alone hid the button on a foreign-language phase whose proposals
  // happened to match the reader's locale, leaving that copy untranslatable.
  const detectionSamples = useMemo(
    () => [
      ...allProposals.map(getProposalDetectionText),
      currentPhase?.headline ?? '',
      currentPhase?.description ?? '',
    ],
    [allProposals, currentPhase?.headline, currentPhase?.description],
  );

  useRegisterTranslationSamples('proposals', detectionSamples);
  const needsTranslation = useDecisionNeedsTranslation();

  const translation = useTranslateDecision({
    proposals: allProposals,
    decisionProfileId,
    needsTranslation,
  });

  const hideFilters = !!proposalsHidden && !canManageProposals;

  // The filter bar's whole state in one object: the URL-backed values and
  // setters from above, plus the pieces only resolvable here (the category list,
  // ballot status, the caller's profile).
  const controls: ProposalControls = {
    search,
    setSearch,
    // `listAllProposals` (results phase) has no search support.
    canSearch: phase !== 'results',
    isSearchPending: isSearchFetching,
    proposalFilter,
    setProposalFilter,
    selectedCategory,
    setSelectedCategory,
    sortOrder,
    setSortOrder,
    categories,
    hasVoted,
    currentProfileId,
    decisionSlug,
  };

  // One sentinel definition for both views — map mode renders it inside the
  // list column (via listFooter), grid mode below the grid. Only the loading
  // skeleton differs.
  const renderScrollSentinel = (skeleton: React.ReactNode) =>
    shouldShowTrigger ? (
      <div
        ref={infiniteScrollRef}
        className="py-4"
        data-testid="proposals-infinite-scroll-sentinel"
      >
        {isFetchingNextPage ? skeleton : null}
      </div>
    ) : null;

  // Empty + unfiltered falls through to the grid's empty state instead of a blank map.
  const isEmptyUnfiltered = allProposals.length === 0 && !hasActiveFilter;

  // With nothing to filter, sort, or export, the control bar is just noise —
  // collapse to the empty state alone. A zero-result FILTERED list keeps the
  // bar so the filter can be cleared. Map mode is not an exception:
  // unfiltered-empty renders the grid empty state, so the bar would only
  // toggle between two empty states.
  const showFilterBar = !isEmptyUnfiltered;

  return (
    <div
      // Nothing visibly unmounts any more, so announce the stale window.
      aria-busy={isFilterFetching || undefined}
      className={cn(
        'relative flex flex-col gap-6 pb-12',
        // On mobile the map view is edge-to-edge and flush to the bottom.
        isMapMode && 'max-sm:pb-0',
      )}
    >
      {showFilterBar && (
        <ProposalsStickyFilterBar
          pinOffset={pinOffset}
          count={total}
          total={totalProposalCount}
          header={header?.(total)}
          // Omitted when the phase hides proposals from non-admins.
          controls={hideFilters ? undefined : controls}
          // Omitted when the process collects no location.
          view={
            hasLocationField
              ? { value: effectiveView, onChange: handleViewChange }
              : undefined
          }
          exportControl={
            canExportProposals ? (
              <ExportProposalsButton
                processInstanceId={queryParams.processInstanceId}
                // The phase's unfiltered count: the export ignores the list's
                // filters, so a filter matching nothing must not disable it.
                isEmpty={totalProposalCount === 0}
              />
            ) : null
          }
        />
      )}

      {translation.translationState && (
        <TranslationNotice
          sourceLanguageName={translation.sourceLanguageName}
          onViewOriginal={translation.handleViewOriginal}
        />
      )}

      <ProposalTranslationProvider
        translations={translation.translationState?.translations ?? {}}
      >
        {isMapMode && !isEmptyUnfiltered ? (
          phase === 'results' ? (
            // Results uses the phase-agnostic `listAllProposals` set; source
            // pins from that same loaded data so pins match the results list.
            <ProposalsMapView
              proposals={allProposals}
              pinProposals={allProposals}
              renderCard={renderCard}
              hrefFor={hrefFor}
              mapView={mapView}
              listFooter={renderScrollSentinel(<ProposalCardSkeleton />)}
            />
          ) : (
            // Local boundaries keep the pin query from suspending / erroring
            // the whole list subtree (filter bar + view toggle stay mounted).
            <APIErrorBoundary
              fallbacks={{
                default: () => (
                  <div className="py-8 text-center text-sm">
                    {t("Couldn't load the map. Refresh to try again.")}
                  </div>
                ),
              }}
            >
              <Suspense fallback={<ProposalListSkeletonGrid />}>
                <ProposalsMapWithLocations
                  proposals={allProposals}
                  renderCard={renderCard}
                  hrefFor={hrefFor}
                  mapView={mapView}
                  // Pins come from a dedicated all-locations query (not the
                  // loaded list pages) so the map isn't capped by the page
                  // size. Strip the list-only pagination fields from the filter.
                  locationFilter={{
                    processInstanceId: queryParams.processInstanceId,
                    categoryId: queryParams.categoryId,
                    search: queryParams.search,
                    submittedByProfileId: queryParams.submittedByProfileId,
                    votedByProfileId: queryParams.votedByProfileId,
                    status: queryParams.status,
                    excludeAssignedForReview:
                      queryParams.excludeAssignedForReview,
                  }}
                  listFooter={renderScrollSentinel(<ProposalCardSkeleton />)}
                />
              </Suspense>
            </APIErrorBoundary>
          )
        ) : (
          <ProposalsGrid
            proposals={allProposals}
            instanceId={instanceId}
            slug={slug}
            decisionSlug={decisionSlug}
            permissions={permissions}
            votedProposalIds={selectedProposalIds}
            hasFilter={hasActiveFilter}
            isVotingPhase={isInVotingPhase}
            proposalsHidden={proposalsHidden}
            excludeAssignedForReview={excludeAssignedForReview}
            revisionRequestIdByProposalId={revisionRequestIdByProposalId}
            isFetchingNextPage={isFetchingNextPage}
          />
        )}
      </ProposalTranslationProvider>

      {/* Grid mode: the load-more skeletons render inside the masonry (see
          ProposalMasonry `loadingMore`), so the sentinel is just the trigger. */}
      {!isMapMode && renderScrollSentinel(null)}

      {translation.showBanner && (
        <TranslateBanner
          onTranslate={translation.handleTranslate}
          onDismiss={translation.dismissBanner}
          isTranslating={translation.isTranslating}
          languageName={translation.targetLanguageName}
        />
      )}

      {hasLocationField && (
        <MobileViewSwitch view={effectiveView} onChange={handleViewChange} />
      )}
    </div>
  );
};
