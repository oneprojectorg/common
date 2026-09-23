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
 * The proposal-filter options, shared by the two controls that render them —
 * the filter select and the tab bar above the list. One list so a filter can't
 * exist on one surface and not the other.
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
