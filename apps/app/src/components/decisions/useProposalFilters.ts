'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { ProposalFilter } from '@op/api/encoders';
import { PROPOSAL_SEARCH_MAX_LENGTH } from '@op/common/client';
import { useDebounce } from '@op/hooks';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { useCallback, useDeferredValue, useMemo } from 'react';

import {
  ALL_CATEGORIES,
  PROPOSAL_STATUS_VALUES,
  type ProposalQueryParams,
  buildQueryParams,
  hasPendingChange,
  isFilterActive,
  resolveFilters,
} from './proposalFilterQuery';
import { useProposalFilterItems } from './useProposalFilterItems';

const PROPOSAL_FILTER_VALUES = Object.values(ProposalFilter);
const SEARCH_DEBOUNCE_MS = 300;

interface ProposalFilterOptions {
  instanceId: string;
  phase?: 'results';
  initialFilter?: ProposalFilter;
  excludeAssignedForReview?: boolean;
  showFilterTabs?: boolean;
  pinnedFilter?: ProposalFilter;
}

/**
 * Every filter the proposal list reads, held in the URL.
 *
 * Cognitive is over the line on the hook calls alone — cyclomatic is 8, and
 * the branching lives in `proposalFilterQuery`, which is unit tested.
 */
// fallow-ignore-next-line complexity
export const useProposalFilters = ({
  instanceId,
  phase,
  initialFilter,
  excludeAssignedForReview,
  showFilterTabs,
  pinnedFilter,
}: ProposalFilterOptions) => {
  const { user } = useUser();
  const currentProfileId = user?.currentProfile?.id;

  const [voteStatus] = trpc.decision.getVotingStatus.useSuspenseQuery({
    processInstanceId: instanceId,
  });
  const hasVoted = voteStatus?.hasVoted ?? false;

  const [selectedCategory, setSelectedCategory] = useQueryState(
    'category',
    parseAsString.withDefault(ALL_CATEGORIES),
  );
  const [sortOrder, setSortOrder] = useQueryState(
    'sort',
    parseAsString.withDefault('newest'),
  );
  const [urlSearch, setSearch] = useQueryState(
    'q',
    parseAsString.withDefault(''),
  );
  const [filterParam, setProposalFilter] = useQueryState(
    'filter',
    parseAsStringLiteral(PROPOSAL_FILTER_VALUES),
  );
  const [statusParam, setStatusFilter] = useQueryState(
    'proposalStatus',
    parseAsStringLiteral(PROPOSAL_STATUS_VALUES).withDefault('all'),
  );

  // Past the cap the endpoint rejects the query and the error boundary takes
  // the list down with it.
  const search = urlSearch.slice(0, PROPOSAL_SEARCH_MAX_LENGTH);
  const [debouncedSearch] = useDebounce(search.trim(), SEARCH_DEBOUNCE_MS);

  // This list's own rail, or a caller's above it. Either leaves the select to
  // the status axis.
  const tabsOwnAudience = showFilterTabs || pinnedFilter !== undefined;

  const { availableFilters, proposalFilter, proposalStatus } = resolveFilters({
    everyFilter: useProposalFilterItems({ hasVoted, currentProfileId }),
    tabsOwnAudience,
    pinnedFilter,
    filterParam,
    initialFilter,
    hasVoted,
    statusParam,
  });

  // Non-urgent, or the suspense boundary swaps the bar (and whatever has focus)
  // for a skeleton. One primitive per call: `useDeferredValue` compares with
  // `Object.is`, so an object snapshot would never settle.
  const appliedSearch = useDeferredValue(debouncedSearch);
  const appliedCategory = useDeferredValue(selectedCategory);
  const appliedSortOrder = useDeferredValue(sortOrder);
  const appliedFilter = useDeferredValue(proposalFilter);
  const appliedStatus = useDeferredValue(proposalStatus);

  // Debounced, not raw: otherwise the spinner lights on the first keystroke.
  const isSearchFetching = appliedSearch !== debouncedSearch;
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
        excludeAssignedForReview,
        currentProfileId,
        category: appliedCategory,
        search: appliedSearch,
        sortOrder: appliedSortOrder,
        filter: appliedFilter,
        status: appliedStatus,
      }),
    [
      instanceId,
      phase,
      excludeAssignedForReview,
      currentProfileId,
      appliedCategory,
      appliedSearch,
      appliedSortOrder,
      appliedFilter,
      appliedStatus,
    ],
  );

  // Read off the applied query, not the live controls, which would flash "no
  // proposals yet" for a frame when clearing a filter that returned nothing.
  const hasActiveFilter = isFilterActive(queryParams);

  // Everything `hasActiveFilter` counts; sort reorders rather than narrows.
  const clearFilters = useCallback(() => {
    setSearch('');
    setSelectedCategory(ALL_CATEGORIES);
    setStatusFilter('all');
    // Pinned, resetting it would write a `filter` param nothing here reads.
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
    voteStatus,
    availableFilters,
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
    clearFilters,
  };
};

export type { ProposalQueryParams };

export type ProposalFilterState = ReturnType<typeof useProposalFilters>;
