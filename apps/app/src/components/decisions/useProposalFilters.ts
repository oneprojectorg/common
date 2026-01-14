'use client';

import { ProposalStatus, type proposalEncoder } from '@op/api/encoders';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';

type Proposal = z.infer<typeof proposalEncoder>;

export type ProposalFilter = 'all' | 'my' | 'shortlisted' | 'my-ballot';

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
    initialFilter || (hasVoted ? 'my-ballot' : 'shortlisted');

  const [proposalFilter, setProposalFilter] =
    useState<ProposalFilter>(defaultFilter);

  // Track previous hasVoted state to detect when user just voted
  const prevHasVotedRef = useRef(hasVoted);

  // Automatically switch to 'my-ballot' when user JUST completed voting (transition from false to true)
  useEffect(() => {
    if (!prevHasVotedRef.current && hasVoted) {
      setProposalFilter('my-ballot');
    }
    prevHasVotedRef.current = hasVoted;
  }, [hasVoted]);

  const filteredProposals = useMemo(() => {
    if (!proposals) {
      return [];
    }

    switch (proposalFilter) {
      case 'my-ballot':
        // Show only proposals the user voted for
        return proposals.filter((proposal) =>
          votedProposalIds.includes(proposal.id),
        );

      case 'my':
        // Show only proposals submitted by the current user
        return proposals.filter(
          (proposal) => proposal.submittedBy?.id === currentProfileId,
        );

      case 'shortlisted':
        // Show only approved proposals
        return proposals.filter(
          (proposal) => proposal.status === ProposalStatus.APPROVED,
        );

      case 'all':
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
