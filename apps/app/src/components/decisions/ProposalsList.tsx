'use client';

import { useAnyContentNeedsTranslation } from '@/hooks/useAnyContentNeedsTranslation';
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
  type AllProposalLocationsFilter,
  type Proposal,
  ProposalReviewRequestState,
  getLocationFieldMapView,
  isReviewPhase,
  isVotingPhase,
  templateCollectsLocation,
} from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { cn } from '@op/ui/utils';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { type RefCallback, Suspense, useCallback, useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { MobileViewSwitch } from './MobileViewSwitch';
import {
  ProposalCardSkeleton,
  ProposalListSkeletonGrid,
} from './ProposalListSkeleton';
import { ProposalTranslationProvider } from './ProposalTranslationContext';
import { PROPOSAL_VIEWS, type ProposalView } from './ProposalViewToggle';
import { ProposalsGrid } from './ProposalsGrid';
import {
  ProposalsMapWithAllLocations,
  ProposalsMapWithLocations,
} from './ProposalsMapView';
import { ProposalsStickyFilterBar } from './ProposalsStickyFilterBar';
import { TranslateBanner } from './TranslateBanner';
import { TranslationNotice } from './TranslationNotice';
import { DEFAULT_LOCATION_FIELD_MAP_VIEW } from './location/mapConfig';
import { getProposalDetectionText } from './translationDetectionText';
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

type ProposalQueryParams = {
  processInstanceId: string;
  categoryId?: string;
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

/**
 * The scope fields the results tab's `listAllProposals` reads share with its
 * map pins. Built in one place so a new filter can't reach the list without
 * also reaching the pins — the exact divergence that capped the results map.
 */
const toAllProposalsFilter = (
  queryParams: ProposalQueryParams,
): AllProposalLocationsFilter => ({
  processInstanceId: queryParams.processInstanceId,
  categoryId: queryParams.categoryId,
  status: queryParams.status,
  submittedByProfileId: queryParams.submittedByProfileId,
  votedByProfileId: queryParams.votedByProfileId,
});

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
        ...toAllProposalsFilter(queryParams),
        dir: queryParams.dir,
        limit: queryParams.limit,
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

  const queryParams = useMemo<ProposalQueryParams>(() => {
    const params: ProposalQueryParams = {
      processInstanceId: instanceId,
      dir: sortOrder === 'newest' ? 'desc' : 'asc',
      limit: PROPOSALS_PAGE_LIMIT,
      phase,
      excludeAssignedForReview,
    };

    if (selectedCategory !== 'all-categories') {
      params.categoryId = selectedCategory;
    }

    // Filter in SQL so pagination and the total count stay accurate per filter.
    if (proposalFilter === ProposalFilter.MY_PROPOSALS && currentProfileId) {
      params.submittedByProfileId = currentProfileId;
    } else if (
      proposalFilter === ProposalFilter.MY_BALLOT &&
      currentProfileId
    ) {
      params.votedByProfileId = currentProfileId;
    }

    return params;
  }, [
    instanceId,
    selectedCategory,
    sortOrder,
    phase,
    proposalFilter,
    currentProfileId,
    excludeAssignedForReview,
  ]);

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

  // Nullable so the default below can depend on whether the process collects a
  // location; the contextual default is stripped from the URL in setView.
  const [view, setView] = useQueryState(
    'view',
    parseAsStringLiteral(PROPOSAL_VIEWS),
  );

  // Map browse mode is offered only when the process collects a location and
  // the GIS flag is on. The map fits the proposal markers; this default view
  // (`x-map-default`) is the fallback camera for when none have a location.
  const gisMapsEnabled = useFeatureFlag('gis_maps');
  const proposalTemplate = instance.instanceData?.proposalTemplate;
  const hasLocationField =
    !!gisMapsEnabled && templateCollectsLocation(proposalTemplate);
  const mapView =
    getLocationFieldMapView(proposalTemplate) ??
    DEFAULT_LOCATION_FIELD_MAP_VIEW;
  // Lead with the map when the process has one — users came here to see places,
  // not titles — and fall back to grid otherwise. Ignores a stale `?view=map`
  // when this process has no map.
  const defaultView: ProposalView = hasLocationField ? 'map' : 'grid';
  const effectiveView: ProposalView = hasLocationField
    ? (view ?? defaultView)
    : 'grid';
  const isMapMode = hasLocationField && effectiveView === 'map';

  const handleViewChange = (next: ProposalView) => {
    // Strip the param when picking the contextual default so the URL stays clean.
    void setView(next === defaultView ? null : next);
  };

  const hasVoted = voteStatus?.hasVoted || false;
  const selectedProposalIds =
    voteStatus?.voteSubmission?.selectedProposalIds || [];

  const canManageProposals = permissions?.admin ?? false;

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

  // Detect per proposal (not one concatenated sample) so proposals that
  // paginate in later are each checked — the badge can appear once a
  // different-language proposal loads further down the list.
  const proposalSamples = useMemo(
    () => allProposals.map(getProposalDetectionText),
    [allProposals],
  );
  const needsTranslation = useAnyContentNeedsTranslation(proposalSamples);

  const translation = useTranslateDecision({
    proposals: allProposals,
    decisionProfileId,
    needsTranslation,
  });

  const hideFilters = !!proposalsHidden && !canManageProposals;

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

  // True for any active filter (category OR All/Mine/Shortlisted) so an empty
  // result reads "none match your filters", not "none yet".
  const hasActiveFilter =
    selectedCategory !== 'all-categories' ||
    proposalFilter !== ProposalFilter.ALL;

  // With nothing to filter, sort, or export, the control bar is just noise —
  // collapse to the empty state alone. Keep it when a filter is active (so a
  // zero-result filter can still be cleared) and in map mode (where the bar
  // hosts the view toggle).
  const showFilterBar = isMapMode || allProposals.length > 0 || hasActiveFilter;

  // Empty + unfiltered falls through to the grid's empty state instead of a blank map.
  const isEmptyUnfiltered = allProposals.length === 0 && !hasActiveFilter;

  // Everything the map needs apart from its pin query — shared by both
  // location-sourced variants below.
  const mapProps = {
    proposals: allProposals,
    instanceId,
    slug,
    decisionSlug,
    permissions,
    mapView,
    listFooter: renderScrollSentinel(<ProposalCardSkeleton />),
  };

  return (
    <div
      className={cn(
        'relative flex flex-col gap-6 pb-12',
        // On mobile the map view is edge-to-edge and flush to the bottom.
        isMapMode && 'max-sm:pb-0',
      )}
    >
      {showFilterBar && (
        <ProposalsStickyFilterBar
          pinOffset={pinOffset}
          hideFilters={hideFilters}
          total={total}
          totalProposalCount={totalProposalCount}
          proposalFilter={proposalFilter}
          setProposalFilter={setProposalFilter}
          hasVoted={hasVoted}
          currentProfileId={currentProfileId}
          decisionSlug={decisionSlug}
          categories={categories}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          sortOrder={sortOrder}
          setSortOrder={setSortOrder}
          hasLocationField={hasLocationField}
          effectiveView={effectiveView}
          onViewChange={handleViewChange}
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
          // Local boundaries keep the pin query from suspending / erroring
          // the whole list subtree (filter bar + view toggle stay mounted).
          <APIErrorBoundary
            fallbacks={{
              default: () => (
                <div className="py-8 text-center text-sm text-neutral-charcoal">
                  {t("Couldn't load the map. Refresh to try again.")}
                </div>
              ),
            }}
          >
            <Suspense fallback={<ProposalListSkeletonGrid />}>
              {/* Pins come from a dedicated all-locations query, not the loaded
                  list pages, so the map isn't capped by the page size. Each
                  variant mirrors the scope of the list beside it. */}
              {phase === 'results' ? (
                <ProposalsMapWithAllLocations
                  {...mapProps}
                  locationFilter={toAllProposalsFilter(queryParams)}
                />
              ) : (
                <ProposalsMapWithLocations
                  {...mapProps}
                  locationFilter={{
                    ...toAllProposalsFilter(queryParams),
                    excludeAssignedForReview:
                      queryParams.excludeAssignedForReview,
                  }}
                />
              )}
            </Suspense>
          </APIErrorBoundary>
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
          />
        )}
      </ProposalTranslationProvider>

      {!isMapMode && renderScrollSentinel(<ProposalListSkeletonGrid />)}

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
