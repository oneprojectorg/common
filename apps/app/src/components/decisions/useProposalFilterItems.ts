'use client';

import { ProposalFilter } from '@op/api/encoders';

import { useTranslations } from '@/lib/i18n';

import type {
  ProposalFilterItem,
  ProposalStatusFilter,
} from './proposalFilterQuery';

/**
 * Every proposal filter, each mapping to a server-side query param so counts
 * and pagination stay accurate. Where a tab bar renders it takes
 * `TAB_BAR_FILTERS` and the select keeps the rest, so each has one control.
 */
export const useProposalFilterItems = ({
  hasVoted,
  currentProfileId,
}: {
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
 * The status axis, so "my proposals" and "not advanced" can both be on at once.
 * Copy is the review queue's, which already names the same concept.
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
