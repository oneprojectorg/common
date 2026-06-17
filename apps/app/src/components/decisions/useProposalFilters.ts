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
    {
      id: ProposalFilter.SHORTLISTED,
      label: t('Shortlisted proposals'),
    },
    ...(hasVoted
      ? [{ id: ProposalFilter.MY_BALLOT, label: t('My ballot') }]
      : []),
  ];
};

// Filter selection state: default, plus auto-switching to "My ballot" the
// moment a user finishes voting. Server-filtered callers (the paginated
// listing) use this directly; in-memory callers compose it via
// `useProposalFilters` below.
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

      case ProposalFilter.SHORTLISTED:
        // Show only approved proposals
        return proposals.filter(
          (proposal) => proposal.status === ProposalStatus.APPROVED,
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
