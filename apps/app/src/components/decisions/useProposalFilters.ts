'use client';

import { ProposalFilter, ProposalStatus } from '@op/api/encoders';
import type { Proposal } from '@op/common/client';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

// Filter items for the proposal `ResponsiveSelect`, shared by ProposalsList and
// ManualSelectionToolbar so labels and disabled rules stay in lockstep.
export const useProposalFilterItems = ({
  hasVoted,
  currentProfileId,
  includeRejected = false,
}: {
  hasVoted: boolean;
  currentProfileId: string | undefined;
  /**
   * Offer the "Rejected" status filter. Off for the manual-selection toolbar:
   * its candidate pool already excludes rejected proposals, so the option
   * could only ever show an empty list there.
   */
  includeRejected?: boolean;
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
    ...(includeRejected
      ? [{ id: ProposalFilter.REJECTED, label: t('Rejected') }]
      : []),
  ];
};

// Filter selection state + auto-switch to "My ballot" once the user votes.
// Composed by `useProposalFilters` (the in-memory candidate-list path).
export function useProposalFilterState({
  hasVoted,
  initialFilter,
}: {
  hasVoted: boolean;
  initialFilter?: ProposalFilter;
}): {
  proposalFilter: ProposalFilter;
  setProposalFilter: (filter: ProposalFilter) => void;
} {
  const defaultFilter: ProposalFilter =
    initialFilter || (hasVoted ? ProposalFilter.MY_BALLOT : ProposalFilter.ALL);

  const [proposalFilter, setProposalFilter] =
    useState<ProposalFilter>(defaultFilter);

  // Switch to "My ballot" when the user JUST voted (hasVoted false -> true).
  const prevHasVotedRef = useRef(hasVoted);
  useEffect(() => {
    if (!prevHasVotedRef.current && hasVoted) {
      setProposalFilter(ProposalFilter.MY_BALLOT);
    }
    prevHasVotedRef.current = hasVoted;
  }, [hasVoted]);

  return { proposalFilter, setProposalFilter };
}

export function useProposalFilters({
  proposals,
  currentProfileId,
  votedProposalIds,
  hasVoted,
  initialFilter,
}: {
  proposals: Proposal[];
  currentProfileId?: string;
  votedProposalIds: string[];
  hasVoted: boolean;
  initialFilter?: ProposalFilter;
}): {
  filteredProposals: Proposal[];
  proposalFilter: ProposalFilter;
  setProposalFilter: (filter: ProposalFilter) => void;
} {
  const { proposalFilter, setProposalFilter } = useProposalFilterState({
    hasVoted,
    initialFilter,
  });

  const filteredProposals = useMemo(() => {
    if (!proposals) {
      return [];
    }

    switch (proposalFilter) {
      case ProposalFilter.MY_BALLOT:
        // Show only proposals the user voted for
        return proposals.filter((proposal) =>
          votedProposalIds.includes(proposal.id),
        );

      case ProposalFilter.MY_PROPOSALS:
        // Show only proposals submitted by the current user
        return proposals.filter(
          (proposal) => proposal.submittedBy?.id === currentProfileId,
        );

      case ProposalFilter.REJECTED:
        return proposals.filter(
          (proposal) => proposal.status === ProposalStatus.REJECTED,
        );

      case ProposalFilter.ALL:
      default:
        // Show all proposals
        return proposals;
    }
  }, [proposals, proposalFilter, votedProposalIds, currentProfileId]);

  return {
    filteredProposals,
    proposalFilter,
    setProposalFilter,
  };
}
