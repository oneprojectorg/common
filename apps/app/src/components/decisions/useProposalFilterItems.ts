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
 * The filters the tab bar owns: the ones that answer *whose* proposals these
 * are. "Not advanced" is the odd one out — it answers what happened to them —
 * so it moves to its own select and the two compose.
 */
export const TAB_BAR_FILTERS: readonly ProposalFilter[] = [
  ProposalFilter.ALL,
  ProposalFilter.MY_PROPOSALS,
  ProposalFilter.MY_BALLOT,
];

export const PROPOSAL_STATUS_VALUES = ['all', 'not-advanced'] as const;

export type ProposalStatusFilter = (typeof PROPOSAL_STATUS_VALUES)[number];

/**
 * The status axis, offered as its own select wherever the tab bar owns the
 * audience axis. Two independent filters rather than one four-way choice, so
 * "my proposals" and "not advanced" can both be on at once — the reader on the
 * My proposals tab who picks Not advanced wants their own rejected proposals,
 * not everyone's.
 *
 * Copy comes from the review namespace, which already owns "Filter by status"
 * and "All statuses" for the review queue's own status select — the same
 * concept, already translated in every locale.
 */
export const useProposalStatusItems = (): {
  id: ProposalStatusFilter;
  label: string;
}[] => {
  const t = useTranslations('decisions');

  return [
    { id: 'all', label: t('review.allStatusesOption') },
    { id: 'not-advanced', label: t('proposals.notAdvancedStatus') },
  ];
};
