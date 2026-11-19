'use client';

import {
  reviewProposalSortSchema,
  reviewProposalStatusSchema,
} from '@op/common/client';
import { parseAsString, parseAsStringLiteral, useQueryState } from 'nuqs';
import { useCallback, useDeferredValue, useMemo } from 'react';
import { z } from 'zod';

import {
  ALL_CATEGORIES,
  PROPOSALS_PAGE_LIMIT,
  hasPendingChange,
} from './proposalFilterQuery';
import { useSearchParam } from './useSearchParam';

export const ALL_REVIEW_STATUSES = 'all';

const reviewStatusFilterSchema = z.enum([
  ALL_REVIEW_STATUSES,
  ...reviewProposalStatusSchema.options,
]);

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
  const [reviewStatus, setReviewStatusParam] = useQueryState(
    'reviewStatus',
    parseAsStringLiteral(reviewStatusFilterSchema.options).withDefault(
      ALL_REVIEW_STATUSES,
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
  const appliedReviewStatus = useDeferredValue(reviewStatus);

  const isFilterFetching = hasPendingChange([
    [appliedSearch, debouncedSearch],
    [appliedCategory, selectedCategory],
    [appliedSortOrder, sortOrder],
    [appliedReviewStatus, reviewStatus],
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
      ...(appliedReviewStatus !== ALL_REVIEW_STATUSES && {
        status: appliedReviewStatus,
      }),
    }),
    [
      processInstanceId,
      appliedSortOrder,
      appliedSearch,
      appliedCategory,
      appliedReviewStatus,
    ],
  );

  const hasActiveFilter = Boolean(
    queryParams.search || queryParams.categoryIds || queryParams.status,
  );

  const clearFilters = useCallback(() => {
    setSearch('');
    setSelectedCategory(ALL_CATEGORIES);
    setReviewStatusParam(ALL_REVIEW_STATUSES);
  }, [setSearch, setSelectedCategory, setReviewStatusParam]);

  const setSort = useCallback(
    (value: string) => {
      const parsed = reviewProposalSortSchema.safeParse(value);
      if (parsed.success) {
        setSortOrder(parsed.data);
      }
    },
    [setSortOrder],
  );

  const setReviewStatus = useCallback(
    (value: string) => {
      const parsed = reviewStatusFilterSchema.safeParse(value);
      if (parsed.success) {
        setReviewStatusParam(parsed.data);
      }
    },
    [setReviewStatusParam],
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
    reviewStatus,
    setReviewStatus,
    hasActiveFilter,
    clearFilters,
  };
};

export type ReviewProposalFilterState = ReturnType<
  typeof useReviewProposalFilters
>;
