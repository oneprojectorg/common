'use client';

import { Select, SelectItem } from '@op/ui/Select';
import type { proposalEncoder } from '@op/api/encoders';
import type { z } from 'zod';
import { ProposalCard } from './ProposalCard';

type Proposal = z.infer<typeof proposalEncoder>;


interface ProposalsListProps {
  proposals: Proposal[];
  onProposalLike?: (proposalId: string) => void;
  onProposalFollow?: (proposalId: string) => void;
}

export function ProposalsList({
  proposals,
  onProposalLike,
  onProposalFollow,
}: ProposalsListProps) {
  if (proposals.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      {/* Filters Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-neutral-charcoal">
            All proposals
          </span>
          <span className="text-sm text-neutral-gray2">• {proposals.length}</span>
        </div>
        <div className="flex items-center gap-4">
          <Select
            placeholder="All categories"
            aria-label="Filter by category"
            className="min-w-[140px]"
          >
            <SelectItem id="all">All categories</SelectItem>
            <SelectItem id="budget">Budget</SelectItem>
            <SelectItem id="policies">Policies</SelectItem>
            <SelectItem id="community">Community</SelectItem>
          </Select>
          <Select
            placeholder="Newest first"
            aria-label="Sort proposals"
            className="min-w-[130px]"
          >
            <SelectItem id="newest">Newest first</SelectItem>
            <SelectItem id="oldest">Oldest first</SelectItem>
            <SelectItem id="most-liked">Most liked</SelectItem>
            <SelectItem id="budget-high">Highest budget</SelectItem>
            <SelectItem id="budget-low">Lowest budget</SelectItem>
          </Select>
        </div>
      </div>

      {/* Proposals List */}
      <div className="space-y-4">
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            onLike={() => onProposalLike?.(proposal.id)}
            onFollow={() => onProposalFollow?.(proposal.id)}
          />
        ))}
      </div>
    </div>
  );
}