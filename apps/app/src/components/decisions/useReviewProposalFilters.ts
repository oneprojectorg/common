'use client';

import { reviewProposalSortSchema } from '@op/common/client';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { useCallback, useDeferredValue, useMemo } from 'react';

import {
  ALL_CATEGORIES,
  PROPOSALS_PAGE_LIMIT,
  hasPendingChange,
} from './proposalFilterQuery';
import { useSearchParam } from './useSearchParam';

interface ReviewProposalFilterOptions {
  processInstanceId: string;
  categoryIds: ReadonlySet<string>;
}

export const useReviewProposalFilters = ({
  processInstanceId,
  categoryIds,
}: ReviewProposalFilterOptions) => {
  const [categoryParam, setSelectedCategory] = useQueryState(
    'category',
    parseAsString.withDefault(ALL_CATEGORIES),
  );
  const [sortOrder, setSortOrder] = useQueryState(
    'reviewSort',
    parseAsStringLiteral(reviewProposalSortSchema.options).withDefault(
      'newest',
    ),
  );
  const {
    search,
    setSearch,
    debouncedSearch,
    appliedSearch,
    isSearchPending: isSearchFetching,
  } = useSearchParam({ key: 'q' });

  const selectedCategory = categoryIds.has(categoryParam)
    ? categoryParam
    : ALL_CATEGORIES;

  // Deferred, or suspense swaps the bar for a skeleton and focus is lost.
  const appliedCategory = useDeferredValue(selectedCategory);
  const appliedSortOrder = useDeferredValue(sortOrder);

  const isFilterFetching = hasPendingChange([
    [appliedSearch, debouncedSearch],
    [appliedCategory, selectedCategory],
    [appliedSortOrder, sortOrder],
  ]);

  const queryParams = useMemo(
    () => ({
      processInstanceId,
      sort: appliedSortOrder,
      limit: PROPOSALS_PAGE_LIMIT,
      ...(appliedSearch && { search: appliedSearch }),
      ...(appliedCategory !== ALL_CATEGORIES && {
        categoryIds: [appliedCategory],
      }),
    }),
    [processInstanceId, appliedSortOrder, appliedSearch, appliedCategory],
  );

  const hasActiveFilter = Boolean(
    queryParams.search || queryParams.categoryIds,
  );

  const clearFilters = useCallback(() => {
    setSearch('');
    setSelectedCategory(ALL_CATEGORIES);
  }, [setSearch, setSelectedCategory]);

  const setSort = useCallback(
    (value: string) => {
      const parsed = reviewProposalSortSchema.safeParse(value);
      if (parsed.success) {
        setSortOrder(parsed.data);
      }
    },
    [setSortOrder],
  );

  return {
    queryParams,
    search,
    setSearch,
    isSearchFetching,
    isFilterFetching,
    selectedCategory,
    setSelectedCategory,
    sortOrder,
    setSortOrder: setSort,
    hasActiveFilter,
    clearFilters,
  };
};

export type ReviewProposalFilterState = ReturnType<
  typeof useReviewProposalFilters
>;
