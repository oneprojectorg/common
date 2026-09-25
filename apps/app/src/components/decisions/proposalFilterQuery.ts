import { ProposalFilter, ProposalStatus } from '@op/api/encoders';

export const ALL_CATEGORIES = 'all-categories';

export interface ProposalFilterItem {
  id: ProposalFilter;
  label: string;
  /** Offered but inert — a profile-bound filter with no profile. */
  isDisabled?: boolean;
}

/** Whose proposals these are. Status is the other axis, in its own select. */
const TAB_BAR_FILTERS: readonly ProposalFilter[] = [
  ProposalFilter.ALL,
  ProposalFilter.MY_PROPOSALS,
  ProposalFilter.MY_BALLOT,
];

export const PROPOSAL_STATUS_VALUES = ['all', 'not-advanced'] as const;

export type ProposalStatusFilter = (typeof PROPOSAL_STATUS_VALUES)[number];

// A multiple of three to fill the grid rows evenly; small because every
// server-side cost of listProposals scales with it.
const PROPOSALS_PAGE_LIMIT = 24;

export type ProposalQueryParams = {
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

interface ResolvedFilters {
  availableFilters: ProposalFilterItem[];
  proposalFilter: ProposalFilter;
  proposalStatus: ProposalStatusFilter;
}

/**
 * Which filters this surface offers and which one is on. A stale link must not
 * filter by a criterion with no control to clear it, so the requested value is
 * resolved against the offered list rather than trusted.
 */
export const resolveFilters = ({
  everyFilter,
  tabsOwnAudience,
  pinnedFilter,
  filterParam,
  initialFilter,
  hasVoted,
  statusParam,
}: {
  everyFilter: ProposalFilterItem[];
  tabsOwnAudience: boolean;
  pinnedFilter: ProposalFilter | undefined;
  filterParam: ProposalFilter | null;
  initialFilter: ProposalFilter | undefined;
  hasVoted: boolean;
  statusParam: ProposalStatusFilter;
}): ResolvedFilters => {
  const availableFilters = tabsOwnAudience
    ? everyFilter.filter((filter) => TAB_BAR_FILTERS.includes(filter.id))
    : everyFilter;

  const defaultFilter = hasVoted
    ? ProposalFilter.MY_BALLOT
    : ProposalFilter.ALL;
  const requested =
    pinnedFilter ?? filterParam ?? initialFilter ?? defaultFilter;

  const proposalFilter =
    availableFilters.find(
      (filter) => filter.id === requested && !filter.isDisabled,
    )?.id ?? ProposalFilter.ALL;

  // `?filter=rejected` predates the status axis.
  const legacyRejected =
    tabsOwnAudience && filterParam === ProposalFilter.REJECTED;

  return {
    availableFilters,
    proposalFilter,
    proposalStatus: legacyRejected ? 'not-advanced' : statusParam,
  };
};

/** Whether the query narrows the phase's full set. Sort reorders, so it isn't one. */
export const isFilterActive = (params: ProposalQueryParams): boolean =>
  Boolean(
    params.search ||
    params.categoryId ||
    params.submittedByProfileId ||
    params.votedByProfileId ||
    params.status,
  );

/** An applied value still trailing its live control. */
export const hasPendingChange = (pairs: [string, string][]): boolean =>
  pairs.some(([applied, live]) => applied !== live);

interface QueryParamsInput {
  instanceId: string;
  phase: 'results' | undefined;
  excludeAssignedForReview: boolean | undefined;
  currentProfileId: string | undefined;
  category: string;
  search: string;
  sortOrder: string;
  filter: ProposalFilter;
  status: ProposalStatusFilter;
}

/** Filtered in SQL so pagination and counts stay accurate per filter. */
export const buildQueryParams = ({
  instanceId,
  phase,
  excludeAssignedForReview,
  currentProfileId,
  category,
  search,
  sortOrder,
  filter,
  status,
}: QueryParamsInput): ProposalQueryParams => {
  const params: ProposalQueryParams = {
    processInstanceId: instanceId,
    dir: sortOrder === 'newest' ? 'desc' : 'asc',
    limit: PROPOSALS_PAGE_LIMIT,
    phase,
    excludeAssignedForReview,
  };

  if (category !== ALL_CATEGORIES) {
    params.categoryId = category;
  }

  // Blank is omitted to keep the untouched query key.
  if (search) {
    params.search = search;
  }

  // The two axes are separate params; the endpoint ANDs them.
  if (filter === ProposalFilter.MY_PROPOSALS && currentProfileId) {
    params.submittedByProfileId = currentProfileId;
  } else if (filter === ProposalFilter.MY_BALLOT && currentProfileId) {
    params.votedByProfileId = currentProfileId;
  }

  if (status === 'not-advanced' || filter === ProposalFilter.REJECTED) {
    params.status = ProposalStatus.REJECTED;
  }

  return params;
};
