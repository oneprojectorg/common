'use client';

import { ProposalFilter } from '@op/api/encoders';

import { useTranslations } from '@/lib/i18n';

// Filter items for the proposal `ResponsiveSelect` on the main proposals list
// (ProposalsFilterBar). Every option maps to a server-side query param — see
// ProposalsList's queryParams — so pagination and counts stay accurate.
export const useProposalFilterItems = ({
  hasVoted,
  currentProfileId,
}: {
  hasVoted: boolean;
  currentProfileId: string | undefined;
}) => {
  const t = useTranslations();
  return [
    { id: ProposalFilter.ALL, label: t('All proposals') },
    {
      id: ProposalFilter.MY_PROPOSALS,
      label: t('My proposals'),
      isDisabled: !currentProfileId,
    },
    ...(hasVoted
      ? [{ id: ProposalFilter.MY_BALLOT, label: t('My ballot') }]
      : []),
    { id: ProposalFilter.REJECTED, label: t('Rejected') },
  ];
};
