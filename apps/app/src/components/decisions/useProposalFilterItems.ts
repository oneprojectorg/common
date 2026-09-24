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
 * The proposal filters a surface offers, shared by the two controls that
 * render them — the filter select and the tab bar above the list — and by the
 * fallback in `ProposalsList` that keeps the applied filter to one of them.
 * One list so a filter can't be applied by a surface that can't show it.
 *
 * Every option maps to a server-side query param in `ProposalsList`'s
 * `queryParams`, so pagination and counts stay accurate per filter.
 */
export const useProposalFilterItems = ({
  hasVoted,
  currentProfileId,
  includeRejected = true,
}: {
  /** The ballot filter only exists once the caller has voted. */
  hasVoted: boolean;
  currentProfileId: string | undefined;
  /**
   * "Not advanced" filters by status where the rest filter by who the reader
   * is, and nothing is rejected until a phase has advanced. As one option
   * among several in a select it costs nothing; as a permanent tab it reads as
   * a section of the decision. The tab bar leaves it out — the review surfaces
   * where proposals actually get rejected keep the select, and it with them.
   */
  includeRejected?: boolean;
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
    ...(includeRejected
      ? [
          {
            id: ProposalFilter.REJECTED,
            label: t('notAdvancedStatus'),
          },
        ]
      : []),
  ];
};
