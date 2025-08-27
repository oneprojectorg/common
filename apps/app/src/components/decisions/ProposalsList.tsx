'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Select, SelectItem } from '@op/ui/Select';
import { useState } from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { ProposalCard } from './ProposalCard';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalsListProps {
  initialProposals: Proposal[];
  slug: string;
  instanceId: string;
}

const NoProposalsFound = () => {
  const t = useTranslations();
  return (
    <div className="py-12 text-center">
      <p className="text-neutral-charcoal">
        {t('No proposals found matching the current filters.')}
      </p>
      <p className="mt-2 text-sm text-neutral-gray2">
        {t('Try adjusting your filter selection above.')}
      </p>
    </div>
  );
};

export function ProposalsList({
  initialProposals,
  slug,
  instanceId,
}: ProposalsListProps) {
  const t = useTranslations();
  const { user } = useUser();
  const [selectedCategory, setSelectedCategory] =
    useState<string>('all-categories');
  const [proposalFilter, setProposalFilter] = useState<string>('all');

  const [categoriesData] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId: instanceId,
  });

  const categories = categoriesData.categories;

  // Get current user's profile ID for "My Proposals" filter
  const currentProfileId = user?.currentProfile?.id;

  const [proposalsData] = trpc.decision.listProposals.useSuspenseQuery(
    {
      processInstanceId: instanceId,
      categoryId:
        selectedCategory === 'all-categories' ? undefined : selectedCategory,
      profileId: proposalFilter === 'my' ? currentProfileId : undefined,
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
            {proposalFilter === 'my'
              ? t('My proposals •')
              : t('All proposals •')}{' '}
            {proposals.length}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Select
            selectedKey={proposalFilter}
            onSelectionChange={(key) => setProposalFilter(String(key))}
            className="w-36"
          >
            <SelectItem id="all">{t('All proposals')}</SelectItem>
            <SelectItem id="my">{t('My proposals')}</SelectItem>
          </Select>
          <Select
            selectedKey={selectedCategory}
            onSelectionChange={(key) => setSelectedCategory(String(key))}
            className="w-40"
            aria-label="Filter proposals by category"
          >
            <SelectItem id="all-categories" aria-label="Show all categories">
              {t('All categories')}
            </SelectItem>
            {categories.map((category) => (
              <SelectItem
                key={category.id}
                id={category.id}
                aria-label={`Filter by ${category.name} category`}
              >
                {category.name}
              </SelectItem>
            ))}
          </Select>
          <Select defaultSelectedKey="newest" className="w-36">
            <SelectItem id="newest">{t('Newest First')}</SelectItem>
            <SelectItem id="oldest">{t('Oldest First')}</SelectItem>
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
