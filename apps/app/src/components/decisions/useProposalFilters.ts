'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProposalFilter } from '@op/api/encoders';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { useCallback, useDeferredValue, useMemo } from 'react';

import { useBallotReceipt } from './ballotReceiptStore';
import {
  ALL_CATEGORIES,
  PROPOSAL_STATUS_VALUES,
  type ProposalQueryParams,
  buildQueryParams,
  hasPendingChange,
  isFilterActive,
  resolveFilters,
} from './proposalFilterQuery';
import {
  useProposalFilterItems,
  useProposalStatusItems,
} from './useProposalFilterItems';
import { useSearchParam } from './useSearchParam';

const PROPOSAL_FILTER_VALUES = Object.values(ProposalFilter);

interface ProposalFilterOptions {
  instanceId: string;
  phase?: 'results';
  initialFilter?: ProposalFilter;
  showFilterTabs?: boolean;
  pinnedFilter?: ProposalFilter;
}

// Complexity here is the hook calls; the branching lives in
// `proposalFilterQuery`, which is unit tested.
// fallow-ignore-next-line complexity
export const useProposalFilters = ({
  instanceId,
  phase,
  initialFilter,
  showFilterTabs,
  pinnedFilter,
}: ProposalFilterOptions) => {
  const { user } = useUser();
  const currentProfileId = user?.currentProfile?.id;

  const receiptState = useBallotReceipt(instanceId);
  const ballotReceipt =
    receiptState.status === 'held' ? receiptState.receipt : undefined;

  const [voteStatus] = trpc.decision.getVotingStatus.useSuspenseQuery({
    processInstanceId: instanceId,
  });
  const hasVoted = voteStatus?.hasVoted ?? false;
  // A ballot cast before votes were unlinked lists without a receipt.
  const ballotIsLinked =
    (voteStatus.voteSubmission?.selectedProposalIds.length ?? 0) > 0;

  const [selectedCategory, setSelectedCategory] = useQueryState(
    'category',
    parseAsString.withDefault(ALL_CATEGORIES),
  );
  const [sortOrder, setSortOrder] = useQueryState(
    'sort',
    parseAsString.withDefault('newest'),
  );
  const {
    search,
    setSearch,
    debouncedSearch,
    appliedSearch,
    isSearchPending: isSearchFetching,
  } = useSearchParam({ key: 'q' });
  const [filterParam, setProposalFilter] = useQueryState(
    'filter',
    parseAsStringLiteral(PROPOSAL_FILTER_VALUES),
  );
  const [statusParam, setStatusFilter] = useQueryState(
    'proposalStatus',
    parseAsStringLiteral(PROPOSAL_STATUS_VALUES),
  );

  const tabsOwnAudience = showFilterTabs || pinnedFilter !== undefined;

  const statusItems = useProposalStatusItems({ currentProfileId });

  const { availableFilters, proposalFilter, proposalStatus } = resolveFilters({
    everyFilter: useProposalFilterItems({ hasVoted, currentProfileId }),
    tabsOwnAudience,
    pinnedFilter,
    filterParam,
    initialFilter,
    hasVoted,
    statusParam,
    availableStatuses: statusItems.map((item) => item.id),
  });

  // Non-urgent, or the suspense boundary swaps the bar (and focus) for a
  // skeleton. One primitive per call: `useDeferredValue` uses `Object.is`.
  const appliedCategory = useDeferredValue(selectedCategory);
  const appliedSortOrder = useDeferredValue(sortOrder);
  const appliedFilter = useDeferredValue(proposalFilter);
  const appliedStatus = useDeferredValue(proposalStatus);

  const isFilterFetching = hasPendingChange([
    [appliedSearch, debouncedSearch],
    [appliedCategory, selectedCategory],
    [appliedSortOrder, sortOrder],
    [appliedFilter, proposalFilter],
    [appliedStatus, proposalStatus],
  ]);

  const queryParams = useMemo(
    () =>
      buildQueryParams({
        instanceId,
        phase,
        currentProfileId,
        ballotReceipt,
        category: appliedCategory,
        search: appliedSearch,
        sortOrder: appliedSortOrder,
        filter: appliedFilter,
        status: appliedStatus,
      }),
    [
      instanceId,
      phase,
      currentProfileId,
      ballotReceipt,
      appliedCategory,
      appliedSearch,
      appliedSortOrder,
      appliedFilter,
      appliedStatus,
    ],
  );

  // Applied, not live: the controls flash "no proposals yet" for a frame when
  // clearing a filter that returned nothing.
  const hasActiveFilter = isFilterActive(queryParams);

  // The receipt is read from this browser's storage after hydration, so the
  // ballot list can't be fetched before then: the server render would ask
  // for a ballot it can't open and the client would ask again.
  const awaitingReceipt =
    queryParams.votedByProfileId !== undefined &&
    !ballotIsLinked &&
    receiptState.status === 'pending';
  const canClearFilters = isFilterActive(queryParams, {
    ignoreAudience: pinnedFilter !== undefined,
  });

  const clearFilters = useCallback(() => {
    setSearch('');
    setSelectedCategory(ALL_CATEGORIES);
    setStatusFilter('all');
    // Pinned, this would write a `filter` param nothing here reads.
    if (pinnedFilter === undefined) {
      setProposalFilter(ProposalFilter.ALL);
    }
  }, [
    setSearch,
    setSelectedCategory,
    setStatusFilter,
    setProposalFilter,
    pinnedFilter,
  ]);

  return {
    queryParams,
    awaitingReceipt,
    voteStatus,
    availableFilters,
    statusItems,
    tabsOwnAudience,
    proposalFilter,
    setProposalFilter,
    proposalStatus,
    setStatusFilter,
    selectedCategory,
    setSelectedCategory,
    sortOrder,
    setSortOrder,
    search,
    setSearch,
    isSearchFetching,
    isFilterFetching,
    hasActiveFilter,
    canClearFilters,
    clearFilters,
  };
};

export type { ProposalQueryParams };

export type ProposalFilterState = ReturnType<typeof useProposalFilters>;
