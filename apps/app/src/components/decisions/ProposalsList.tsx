'use client';

import type { proposalEncoder } from '@op/api/encoders';
import { Select, SelectItem } from '@op/ui/Select';
import type { z } from 'zod';

import { ProposalCard } from './ProposalCard';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalsListProps {
  proposals: Proposal[];
  slug: string;
  instanceId: string;
}

export function ProposalsList({
  proposals,
  slug,
  instanceId,
}: ProposalsListProps) {
  if (proposals.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      {/* Filters Bar */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-lg font-medium text-neutral-charcoal">
            My proposals • {proposals.length}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Select defaultSelectedKey="my" className="w-36">
            <SelectItem id="my">My proposals</SelectItem>
            <SelectItem id="all">All proposals</SelectItem>
          </Select>
          <Select defaultSelectedKey="all-categories" className="w-40">
            <SelectItem id="all-categories">All categories</SelectItem>
          </Select>
          <Select defaultSelectedKey="newest" className="w-36">
            <SelectItem id="newest">Newest First</SelectItem>
            <SelectItem id="oldest">Oldest First</SelectItem>
          </Select>
        </div>
      </div>

      {/* Proposals List */}
      <div className="space-y-4">
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            viewHref={`/profile/${slug}/decisions/${instanceId}/proposal/${proposal.id}`}
          />
        ))}
      </div>
    </div>
  );
}
