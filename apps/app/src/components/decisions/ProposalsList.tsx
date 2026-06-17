'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import {
  type DecisionAccess,
  type InstancePhaseData,
  ProposalFilter,
  ProposalStatus,
} from '@op/api/encoders';
import { type Proposal, ProposalReviewRequestState } from '@op/common/client';
import { useInfiniteScroll } from '@op/hooks';
import { Link } from '@op/ui/Link';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { type RefObject, useCallback, useMemo } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalListSkeletonGrid } from './ProposalListSkeleton';
import { ProposalTranslationProvider } from './ProposalTranslationContext';
import { ProposalsFilterBar, ProposalsListHeader } from './ProposalsFilterBar';
import { ProposalsGrid } from './ProposalsGrid';
import { TranslateBanner } from './TranslateBanner';
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
  const [[categoriesData, voteStatus]] = trpc.useSuspenseQueries((t) => [
    t.decision.getCategories({
      processInstanceId: instanceId,
    }),
    t.decision.getVotingStatus({
      processInstanceId: instanceId,
    }),
  ]);

  const categories = categoriesData.categories;

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

  return (
    <div className="flex flex-col gap-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <ProposalsListHeader
            hideFilters={hideFilters}
            proposalFilter={proposalFilter}
            // Server-side filtering makes `total` accurate for the active filter.
            count={total}
          />
        </div>
        {!hideFilters && (
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
        <ProposalsGrid
          proposals={allProposals}
          instanceId={instanceId}
          slug={slug}
          decisionSlug={decisionSlug}
          permissions={permissions}
          votedProposalIds={selectedProposalIds}
          hasFilter={selectedCategory !== 'all-categories'}
          isVotingPhase={isVotingPhase}
          proposalsHidden={proposalsHidden}
          revisionRequestIdByProposalId={revisionRequestIdByProposalId}
        />
      </ProposalTranslationProvider>

      {shouldShowTrigger && (
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
    </div>
  );
};
