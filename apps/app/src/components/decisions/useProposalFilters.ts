'use client';

import {
  ProposalFilter,
  ProposalStatus,
  type proposalEncoder,
} from '@op/api/encoders';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;

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
  // Set default filter based on initialFilter or hasVoted status
  const defaultFilter: ProposalFilter =
    initialFilter || (hasVoted ? ProposalFilter.MY_BALLOT : ProposalFilter.ALL);

  const [proposalFilter, setProposalFilter] =
    useState<ProposalFilter>(defaultFilter);

  // Track previous hasVoted state to detect when user just voted
  const prevHasVotedRef = useRef(hasVoted);

  // Automatically switch to 'my-ballot' when user JUST completed voting (transition from false to true)
  useEffect(() => {
    if (!prevHasVotedRef.current && hasVoted) {
      setProposalFilter(ProposalFilter.MY_BALLOT);
    }
    prevHasVotedRef.current = hasVoted;
  }, [hasVoted]);

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
