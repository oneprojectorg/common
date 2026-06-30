'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
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
  getLocationFieldMapView,
  templateCollectsLocation,
} from '@op/common/client';
import { useInfiniteScroll, useIntersectionObserver } from '@op/hooks';
import { Button } from '@op/ui/Button';
import { Link } from '@op/ui/Link';
import { cn } from '@op/ui/utils';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { type RefObject, useCallback, useMemo } from 'react';
import { LuLayoutGrid, LuMap } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ProposalListSkeletonGrid } from './ProposalListSkeleton';
import { ProposalTranslationProvider } from './ProposalTranslationContext';
import {
  PROPOSAL_VIEWS,
  type ProposalView,
  ProposalViewToggle,
} from './ProposalViewToggle';
import { ProposalsFilterBar, ProposalsListHeader } from './ProposalsFilterBar';
import { ProposalsGrid } from './ProposalsGrid';
import { ProposalsMapView } from './ProposalsMapView';
import { TranslateBanner } from './TranslateBanner';
import { DEFAULT_LOCATION_FIELD_MAP_VIEW } from './location/mapConfig';
import { useProposalExport } from './useProposalExport';
import { useProposalsTranslation } from './useProposalsTranslation';

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
}

// A multiple of three so a full page fills the three-per-row grid evenly.
const PROPOSALS_PAGE_LIMIT = 51;

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
};

type ProposalsLoaderRenderProps = {
  allProposals: Proposal[];
  /** Full server-side proposal count, independent of how many pages are loaded. */
  total: number;
  isFetchingNextPage: boolean;
  shouldShowTrigger: boolean;
  infiniteScrollRef: RefObject<HTMLDivElement | null>;
};

const useProposalsLoaderRenderProps = (
  allProposals: Proposal[],
  total: number,
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

  const allProposals = useMemo(
    () => paginatedData.pages.flatMap((page) => page.proposals),
    [paginatedData.pages],
  );
  const total = paginatedData.pages[0]?.total ?? 0;

  return children(useProposalsLoaderRenderProps(allProposals, total, query));
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

  const allProposals = useMemo(
    () => paginatedData.pages.flatMap((page) => page.items),
    [paginatedData.pages],
  );
  const total = paginatedData.pages[0]?.total ?? 0;

  return children(useProposalsLoaderRenderProps(allProposals, total, query));
};

export const ProposalsList = (props: ProposalsListProps) => {
  const { instanceId, phase, initialFilter } = props;

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
    };

    if (selectedCategory !== 'all-categories') {
      params.categoryId = selectedCategory;
    }

    // Filter in SQL so pagination and the total count stay accurate per filter.
    if (proposalFilter === ProposalFilter.MY_PROPOSALS && currentProfileId) {
      params.submittedByProfileId = currentProfileId;
    } else if (proposalFilter === ProposalFilter.SHORTLISTED) {
      params.status = ProposalStatus.APPROVED;
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
  ]);

  const renderContent = (data: ProposalsLoaderRenderProps) => (
    <ProposalsListContent
      {...props}
      {...data}
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
  allProposals,
  total,
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
  const isReviewPhase = currentPhase?.rules?.proposals?.review === true;
  const isVotingPhase = currentPhase?.rules?.voting?.submit === true;
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
    gisMapsEnabled && templateCollectsLocation(proposalTemplate);
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

  const {
    startExport,
    isExporting,
    isDownloadReady,
    downloadUrl,
    downloadFileName,
  } = useProposalExport();

  const canManageProposals = permissions?.admin ?? false;

  const { data: revisionRequestsData } =
    trpc.decision.listProposalsRevisionRequests.useQuery(
      { states: [ProposalReviewRequestState.REQUESTED] },
      { enabled: !!isReviewPhase },
    );

  const revisionRequestIdByProposalId = new Map<string, string>(
    revisionRequestsData?.revisionRequests.map(
      ({ proposal, revisionRequest }) => [proposal.id, revisionRequest.id],
    ),
  );

  const translation = useProposalsTranslation({
    allProposals,
    decisionProfileId,
  });

  const handleExport = () => {
    startExport(
      {
        processInstanceId: instanceId,
        categoryId:
          selectedCategory !== 'all-categories' ? selectedCategory : undefined,
        dir: sortOrder === 'newest' ? 'desc' : 'asc',
        proposalFilter,
      },
      'csv',
    );
  };

  const hideFilters = !!proposalsHidden && !canManageProposals;

  // The filter bar pins at top-14 (56px). A zero-height sentinel at its natural
  // top is observed against the viewport shrunk by that offset; once the
  // sentinel scrolls past it the bar is pinned. initialIsIntersecting avoids a
  // one-frame "stuck" flash on mount. Drives the full-width borders via the
  // data-stuck attribute on the bar below.
  const { ref: filterSentinelRef, isIntersecting } =
    useIntersectionObserver<HTMLDivElement>({
      rootMargin: '-56px 0px 0px 0px',
      initialIsIntersecting: true,
    });
  const isFilterBarStuck = !isIntersecting;

  return (
    <div
      className={cn(
        'relative flex flex-col gap-6 pb-12',
        // On mobile the map view is edge-to-edge and flush to the bottom.
        isMapMode && 'max-sm:pb-0',
      )}
    >
      {/* Sentinel at the filter bar's pre-pin top — drives the JS "stuck"
          detection that toggles data-stuck on the bar below. */}
      <div
        ref={filterSentinelRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
      />
      {/* Filters Bar — sticks beneath the decision nav while the list/map
          scroll under it. Only once pinned, full-bleed top/bottom lines fade
          in via the before/after pseudo-elements (toggled by data-stuck). */}
      <div
        data-stuck={isFilterBarStuck || undefined}
        className={cn(
          'sticky top-14 z-20 flex flex-wrap items-center justify-between gap-4 bg-white py-3',
          "before:pointer-events-none before:absolute before:top-0 before:left-1/2 before:w-screen before:-translate-x-1/2 before:border-t before:border-neutral-gray1 before:opacity-0 before:content-['']",
          "after:pointer-events-none after:absolute after:-bottom-px after:left-1/2 after:w-screen after:-translate-x-1/2 after:border-b after:border-neutral-gray1 after:opacity-0 after:content-['']",
          'data-[stuck=true]:before:opacity-100 data-[stuck=true]:after:opacity-100',
          // On mobile the map view is edge-to-edge, so break the bar out to full
          // width too (restoring the container's 1rem gutter).
          isMapMode &&
            'max-sm:ml-[calc(50%_-_50vw)] max-sm:w-screen max-sm:px-4',
        )}
      >
        <div className="flex items-center gap-4">
          <ProposalsListHeader
            hideFilters={hideFilters}
            proposalFilter={proposalFilter}
            // Server-side filtering makes `total` accurate for the active filter.
            count={total}
          />
        </div>
        {!hideFilters && (
          <div className="flex items-center gap-4">
            <ProposalsFilterBar
              hasVoted={hasVoted}
              currentProfileId={currentProfileId}
              proposalFilter={proposalFilter}
              setProposalFilter={setProposalFilter}
              categories={categories}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              sortOrder={sortOrder}
              onSelectSort={setSortOrder}
              canManageProposals={canManageProposals}
              isExporting={isExporting}
              isDownloadReady={isDownloadReady}
              downloadUrl={downloadUrl}
              downloadFileName={downloadFileName}
              onExport={handleExport}
            />
            {hasLocationField && (
              <div className="hidden items-center gap-4 sm:flex">
                <span aria-hidden className="h-6 w-px bg-neutral-gray2" />
                <ProposalViewToggle
                  value={effectiveView}
                  onChange={handleViewChange}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {translation.translationState && (
        <p className="text-sm text-neutral-gray3">
          {t('Translated from {language}', {
            language: translation.sourceLanguageName,
          })}{' '}
          &middot;{' '}
          <Link
            onPress={translation.handleViewOriginal}
            className="text-sm font-semibold"
          >
            {t('View original')}
          </Link>
        </p>
      )}

      <ProposalTranslationProvider
        translations={translation.translationState?.translations ?? {}}
      >
        {isMapMode ? (
          <ProposalsMapView
            proposals={allProposals}
            instanceId={instanceId}
            slug={slug}
            decisionSlug={decisionSlug}
            permissions={permissions}
            mapView={mapView}
          />
        ) : (
          <ProposalsGrid
            proposals={allProposals}
            instanceId={instanceId}
            slug={slug}
            decisionSlug={decisionSlug}
            permissions={permissions}
            votedProposalIds={selectedProposalIds}
            // True for any active filter (category OR All/Mine/Shortlisted) so an
            // empty result reads "none match your filters", not "none yet".
            hasFilter={
              selectedCategory !== 'all-categories' ||
              proposalFilter !== ProposalFilter.ALL
            }
            isVotingPhase={isVotingPhase}
            proposalsHidden={proposalsHidden}
            revisionRequestIdByProposalId={revisionRequestIdByProposalId}
          />
        )}
      </ProposalTranslationProvider>

      {!isMapMode && shouldShowTrigger && (
        <div
          ref={infiniteScrollRef}
          className="py-4"
          data-testid="proposals-infinite-scroll-sentinel"
        >
          {isFetchingNextPage ? <ProposalListSkeletonGrid /> : null}
        </div>
      )}

      {translation.showBanner && (
        <TranslateBanner
          onTranslate={translation.handleTranslate}
          onDismiss={translation.dismissBanner}
          isTranslating={translation.isTranslating}
          languageName={translation.targetLanguageName}
        />
      )}

      {/* Mobile-only view switch, sticky at the bottom of the screen. Reads
          "Map" while listing, "List" while showing the map. */}
      {hasLocationField && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center sm:hidden">
          <Button
            color="secondary"
            onPress={() =>
              handleViewChange(effectiveView === 'map' ? 'grid' : 'map')
            }
            className="shadow-lg"
          >
            {effectiveView === 'map' ? (
              <>
                <LuLayoutGrid className="size-4" />
                {t('List')}
              </>
            ) : (
              <>
                <LuMap className="size-4" />
                {t('Map')}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
};
