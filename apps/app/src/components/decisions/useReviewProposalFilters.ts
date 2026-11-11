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

export const ALL_DISTRICTS = 'all-districts';

interface ReviewProposalFilterOptions {
  processInstanceId: string;
  /** Category term ids the category select offers. */
  categoryIds: ReadonlySet<string>;
  /** Category term ids the district select offers. */
  districtIds: ReadonlySet<string>;
}

/**
 * URL-backed filters for the review page's "All proposals" list. The category
 * and the district are both category terms, so both go to the endpoint as
 * `categoryIds`, which it ANDs. A param naming a term this decision doesn't
 * offer reads as "all".
 */
export const useReviewProposalFilters = ({
  processInstanceId,
  categoryIds,
  districtIds,
}: ReviewProposalFilterOptions) => {
  const [categoryParam, setSelectedCategory] = useQueryState(
    'category',
    parseAsString.withDefault(ALL_CATEGORIES),
  );
  const [districtParam, setSelectedDistrict] = useQueryState(
    'district',
    parseAsString.withDefault(ALL_DISTRICTS),
  );
  const [sortOrder, setSortOrder] = useQueryState(
    'sort',
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
  const selectedDistrict = districtIds.has(districtParam)
    ? districtParam
    : ALL_DISTRICTS;

  // Non-urgent, or the suspense boundary swaps the bar (and focus) for a
  // skeleton.
  const appliedCategory = useDeferredValue(selectedCategory);
  const appliedDistrict = useDeferredValue(selectedDistrict);
  const appliedSortOrder = useDeferredValue(sortOrder);

  const isFilterFetching = hasPendingChange([
    [appliedSearch, debouncedSearch],
    [appliedCategory, selectedCategory],
    [appliedDistrict, selectedDistrict],
    [appliedSortOrder, sortOrder],
  ]);

  const queryParams = useMemo(() => {
    const selectedTermIds = [
      appliedCategory === ALL_CATEGORIES ? null : appliedCategory,
      appliedDistrict === ALL_DISTRICTS ? null : appliedDistrict,
    ].filter((id): id is string => id !== null);

    return {
      processInstanceId,
      sort: appliedSortOrder,
      limit: PROPOSALS_PAGE_LIMIT,
      // Blank values are omitted to keep the untouched query key.
      ...(appliedSearch && { search: appliedSearch }),
      ...(selectedTermIds.length > 0 && { categoryIds: selectedTermIds }),
    };
  }, [
    processInstanceId,
    appliedSortOrder,
    appliedSearch,
    appliedCategory,
    appliedDistrict,
  ]);

  const hasActiveFilter = Boolean(
    queryParams.search || queryParams.categoryIds,
  );

  const clearFilters = useCallback(() => {
    setSearch('');
    setSelectedCategory(ALL_CATEGORIES);
    setSelectedDistrict(ALL_DISTRICTS);
  }, [setSearch, setSelectedCategory, setSelectedDistrict]);

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
    selectedDistrict,
    setSelectedDistrict,
    sortOrder,
    setSortOrder: setSort,
    hasActiveFilter,
    clearFilters,
  };
};

export type ReviewProposalFilterState = ReturnType<
  typeof useReviewProposalFilters
>;
