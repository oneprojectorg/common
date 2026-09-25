import { ProposalFilter, ProposalStatus } from '@op/api/encoders';

export const ALL_CATEGORIES = 'all-categories';

export interface ProposalFilterItem {
  id: ProposalFilter;
  label: string;
  isDisabled?: boolean;
}

const TAB_BAR_FILTERS: readonly ProposalFilter[] = [
  ProposalFilter.ALL,
  ProposalFilter.MY_PROPOSALS,
  ProposalFilter.MY_BALLOT,
];

export const PROPOSAL_STATUS_VALUES = ['all', 'not-advanced'] as const;

export type ProposalStatusFilter = (typeof PROPOSAL_STATUS_VALUES)[number];

// A multiple of three, to fill the grid rows evenly.
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
  statusParam: ProposalStatusFilter | null;
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

  // `?filter=rejected` predates the status axis; it yields to an explicit pick.
  const legacyRejected =
    tabsOwnAudience && filterParam === ProposalFilter.REJECTED;

  return {
    availableFilters,
    proposalFilter,
    proposalStatus: statusParam ?? (legacyRejected ? 'not-advanced' : 'all'),
  };
};

// `ignoreAudience` excludes a pinned filter, which cannot be cleared.
export const isFilterActive = (
  params: ProposalQueryParams,
  { ignoreAudience = false }: { ignoreAudience?: boolean } = {},
): boolean =>
  Boolean(
    params.search ||
    params.categoryId ||
    params.status ||
    (!ignoreAudience &&
      (params.submittedByProfileId || params.votedByProfileId)),
  );

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
