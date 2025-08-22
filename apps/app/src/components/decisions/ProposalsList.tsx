'use client';

import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Select, SelectItem } from '@op/ui/Select';
import { useState } from 'react';
import type { z } from 'zod';

import { ProposalCard } from './ProposalCard';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalsListProps {
  initialProposals: Proposal[];
  slug: string;
  instanceId: string;
}

const NoProposalsFound = () => (
  <div className="py-12 text-center">
    <p className="text-neutral-charcoal">
      No proposals found matching the current filters.
    </p>
    <p className="mt-2 text-sm text-neutral-gray2">
      Try adjusting your filter selection above.
    </p>
  </div>
);

export function ProposalsList({
  initialProposals,
  slug,
  instanceId,
}: ProposalsListProps) {
  const [selectedCategory, setSelectedCategory] =
    useState<string>('all-categories');

  const [categoriesData] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId: instanceId,
  });

  const categories = categoriesData.categories;

  const [proposalsData] = trpc.decision.listProposals.useSuspenseQuery(
    {
      processInstanceId: instanceId,
      categoryId:
        selectedCategory === 'all-categories' ? undefined : selectedCategory,
      limit: 50,
    },
    {
      initialData: {
        proposals: initialProposals,
        total: initialProposals.length,
        hasMore: false,
      },
    },
  );

  const { proposals } = proposalsData;

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
          <Select defaultSelectedKey="all" className="w-36">
            <SelectItem id="my">My proposals</SelectItem>
            <SelectItem id="all">All proposals</SelectItem>
          </Select>
          <Select
            selectedKey={selectedCategory}
            onSelectionChange={(key) => setSelectedCategory(String(key))}
            className="w-40"
          >
            <SelectItem id="all-categories">All categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category.id} id={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </Select>
          <Select defaultSelectedKey="newest" className="w-36">
            <SelectItem id="newest">Newest First</SelectItem>
            <SelectItem id="oldest">Oldest First</SelectItem>
          </Select>
        </div>
      </div>

      {/* Proposals List or Empty State */}
      {proposals.length === 0 ? (
        <NoProposalsFound />
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <ProposalCard
              key={proposal.id}
              proposal={proposal}
              viewHref={`/profile/${slug}/decisions/${instanceId}/proposal/${proposal.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
