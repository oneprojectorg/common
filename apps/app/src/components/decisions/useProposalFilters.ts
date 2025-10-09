'use client';

import type { proposalEncoder } from '@op/api/encoders';
import { useMemo, useState } from 'react';
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
  // Set default filter: 'my-ballot' if user has voted, otherwise use initialFilter or 'all'
  const defaultFilter: ProposalFilter = hasVoted
    ? 'my-ballot'
    : initialFilter || 'all';

  const [proposalFilter, setProposalFilter] =
    useState<ProposalFilter>(defaultFilter);

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
          (proposal) => proposal.profileId === currentProfileId,
        );

      case 'shortlisted':
        // Show only approved proposals
        return proposals.filter((proposal) => proposal.status === 'approved');

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
