'use client';

import { ProposalFilter } from '@op/api/encoders';

import { useTranslations } from '@/lib/i18n';

export interface ProposalFilterItem {
  id: ProposalFilter;
  label: string;
  /** A profile-bound filter with no profile: offered but inert, never silently wrong. */
  isDisabled?: boolean;
}

/**
 * Every proposal filter a surface offers. The select renders them all; where
 * the tab bar is shown it takes `TAB_BAR_FILTERS` and the select drops those
 * from its own options, so each filter has exactly one control. `ProposalsList`
 * reads the whole list to keep the applied filter to one of them.
 *
 * Every option maps to a server-side query param in `ProposalsList`'s
 * `queryParams`, so pagination and counts stay accurate per filter.
 */
export const useProposalFilterItems = ({
  hasVoted,
  currentProfileId,
}: {
  /** The ballot filter only exists once the caller has voted. */
  hasVoted: boolean;
  currentProfileId: string | undefined;
}): ProposalFilterItem[] => {
  const t = useTranslations('decisions.proposals');

  return [
    {
      id: ProposalFilter.ALL,
      label: t('allProposalsOption'),
    },
    {
      id: ProposalFilter.MY_PROPOSALS,
      label: t('myProposalsOption'),
      isDisabled: !currentProfileId,
    },
    ...(hasVoted
      ? [
          {
            id: ProposalFilter.MY_BALLOT,
            label: t('myBallotOption'),
            isDisabled: !currentProfileId,
          },
        ]
      : []),
    {
      id: ProposalFilter.REJECTED,
      label: t('notAdvancedStatus'),
    },
  ];
};

/**
 * The filters the tab bar owns. Everything else stays in the select beside the
 * category and sort dropdowns, where "Not advanced" reads as one more way to
 * narrow the list rather than as a section of the decision.
 */
export const TAB_BAR_FILTERS: readonly ProposalFilter[] = [
  ProposalFilter.ALL,
  ProposalFilter.MY_PROPOSALS,
];

/**
 * What a control shows when the active filter belongs to the other one.
 *
 * The two controls share a single filter, so only one of them can hold it at a
 * time. The other falls back to "All proposals" — true in the sense that
 * matters to it (the list is not narrowed to the reader's own proposals), and
 * the control actually holding the filter is on screen saying so, the same way
 * an active category or search term narrows a list that still reads "All
 * proposals".
 */
export const getDisplayedFilter = (
  items: ProposalFilterItem[],
  activeFilter: ProposalFilter,
): ProposalFilter =>
  items.some((item) => item.id === activeFilter)
    ? activeFilter
    : ProposalFilter.ALL;
