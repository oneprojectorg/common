import { ProposalFilter, ProposalStatus } from '@op/api/encoders';
import { describe, expect, it } from 'vitest';

import {
  buildQueryParams,
  isFilterActive,
  resolveFilters,
} from './proposalFilterQuery';
import type { ProposalFilterItem } from './proposalFilterQuery';

const MY_PROFILE = 'profile-1';

const items = (hasVoted: boolean, profileId?: string): ProposalFilterItem[] => [
  { id: ProposalFilter.ALL, label: 'All proposals' },
  {
    id: ProposalFilter.MY_PROPOSALS,
    label: 'My proposals',
    isDisabled: !profileId,
  },
  ...(hasVoted
    ? [
        {
          id: ProposalFilter.MY_BALLOT,
          label: 'My ballot',
          isDisabled: !profileId,
        },
      ]
    : []),
  { id: ProposalFilter.REJECTED, label: 'Not advanced' },
];

const resolve = (
  overrides: Partial<Parameters<typeof resolveFilters>[0]> = {},
) =>
  resolveFilters({
    everyFilter: items(false, MY_PROFILE),
    tabsOwnAudience: true,
    pinnedFilter: undefined,
    filterParam: null,
    initialFilter: undefined,
    hasVoted: false,
    statusParam: 'all',
    ...overrides,
  });

describe('resolveFilters', () => {
  it('keeps the status filter out of the audience axis where tabs own it', () => {
    expect(resolve().availableFilters.map((item) => item.id)).toEqual([
      ProposalFilter.ALL,
      ProposalFilter.MY_PROPOSALS,
    ]);
  });

  it('offers every filter where the select is the only control', () => {
    expect(
      resolve({ tabsOwnAudience: false }).availableFilters.map(
        (item) => item.id,
      ),
    ).toContain(ProposalFilter.REJECTED);
  });

  it('reads a pre-split ?filter=rejected as the status axis', () => {
    const { proposalFilter, proposalStatus } = resolve({
      filterParam: ProposalFilter.REJECTED,
    });

    expect(proposalFilter).toBe(ProposalFilter.ALL);
    expect(proposalStatus).toBe('not-advanced');
  });

  it('leaves ?filter=rejected alone where the select still offers it', () => {
    const { proposalFilter, proposalStatus } = resolve({
      tabsOwnAudience: false,
      filterParam: ProposalFilter.REJECTED,
    });

    expect(proposalFilter).toBe(ProposalFilter.REJECTED);
    expect(proposalStatus).toBe('all');
  });

  it('prefers a pinned filter over the URL', () => {
    expect(
      resolve({
        pinnedFilter: ProposalFilter.MY_PROPOSALS,
        filterParam: ProposalFilter.ALL,
      }).proposalFilter,
    ).toBe(ProposalFilter.MY_PROPOSALS);
  });

  it('falls back to all when the reader has no profile to filter on', () => {
    expect(
      resolve({
        everyFilter: items(false),
        filterParam: ProposalFilter.MY_PROPOSALS,
      }).proposalFilter,
    ).toBe(ProposalFilter.ALL);
  });

  it('falls back to all for a ballot link from someone who has not voted', () => {
    expect(
      resolve({ filterParam: ProposalFilter.MY_BALLOT }).proposalFilter,
    ).toBe(ProposalFilter.ALL);
  });

  it('defaults to the ballot once the reader has voted', () => {
    expect(
      resolve({ everyFilter: items(true, MY_PROFILE), hasVoted: true })
        .proposalFilter,
    ).toBe(ProposalFilter.MY_BALLOT);
  });
});

const build = (
  overrides: Partial<Parameters<typeof buildQueryParams>[0]> = {},
) =>
  buildQueryParams({
    instanceId: 'instance-1',
    phase: undefined,
    excludeAssignedForReview: undefined,
    currentProfileId: MY_PROFILE,
    category: 'all-categories',
    search: '',
    sortOrder: 'newest',
    filter: ProposalFilter.ALL,
    status: 'all',
    ...overrides,
  });

describe('buildQueryParams', () => {
  it('applies both axes at once', () => {
    const params = build({
      filter: ProposalFilter.MY_PROPOSALS,
      status: 'not-advanced',
    });

    expect(params.submittedByProfileId).toBe(MY_PROFILE);
    expect(params.status).toBe(ProposalStatus.REJECTED);
  });

  it('applies the status axis on its own', () => {
    const params = build({ status: 'not-advanced' });

    expect(params.submittedByProfileId).toBeUndefined();
    expect(params.status).toBe(ProposalStatus.REJECTED);
  });

  it('sends the ballot as its own param', () => {
    const params = build({ filter: ProposalFilter.MY_BALLOT });

    expect(params.votedByProfileId).toBe(MY_PROFILE);
    expect(params.submittedByProfileId).toBeUndefined();
  });

  it('ignores a profile-bound filter with no profile', () => {
    expect(
      build({
        filter: ProposalFilter.MY_PROPOSALS,
        currentProfileId: undefined,
      }).submittedByProfileId,
    ).toBeUndefined();
  });

  it('omits an untouched category and a blank search', () => {
    const params = build();

    expect(params.categoryId).toBeUndefined();
    expect(params.search).toBeUndefined();
  });

  it('carries a narrowed category and a typed search', () => {
    const params = build({ category: 'cat-1', search: 'bike' });

    expect(params.categoryId).toBe('cat-1');
    expect(params.search).toBe('bike');
  });

  it('maps the sort order onto the query direction', () => {
    expect(build().dir).toBe('desc');
    expect(build({ sortOrder: 'oldest' }).dir).toBe('asc');
  });
});

describe('isFilterActive', () => {
  it('is false for the untouched phase set', () => {
    expect(isFilterActive(build())).toBe(false);
  });

  it('is true for each axis on its own', () => {
    expect(isFilterActive(build({ search: 'bike' }))).toBe(true);
    expect(isFilterActive(build({ category: 'cat-1' }))).toBe(true);
    expect(isFilterActive(build({ status: 'not-advanced' }))).toBe(true);
    expect(isFilterActive(build({ filter: ProposalFilter.MY_PROPOSALS }))).toBe(
      true,
    );
  });

  it('ignores the sort order, which reorders rather than narrows', () => {
    expect(isFilterActive(build({ sortOrder: 'oldest' }))).toBe(false);
  });
});
