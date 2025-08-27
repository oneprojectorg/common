'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Select, SelectItem } from '@op/ui/Select';
import { useMemo, useState } from 'react';

import { useTranslations } from '@/lib/i18n';

import { ProposalCard } from './ProposalCard';


interface ProposalsListProps {
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
  slug,
  instanceId,
}: ProposalsListProps) {
  const t = useTranslations();
  const { user } = useUser();
  const [selectedCategory, setSelectedCategory] =
    useState<string>('all-categories');
  const [proposalFilter, setProposalFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<string>('newest');

  const [categoriesData] = trpc.decision.getCategories.useSuspenseQuery({
    processInstanceId: instanceId,
  });

  const categories = categoriesData.categories;

  // Get current user's profile ID for "My Proposals" filter
  const currentProfileId = user?.currentProfile?.id;

  // Build query parameters, ensuring consistent structure
  const queryParams = useMemo(() => {
    const params: {
      processInstanceId: string;
      categoryId?: string;
      submittedByProfileId?: string;
      dir: 'asc' | 'desc';
      limit: number;
    } = {
      processInstanceId: instanceId,
      dir: sortOrder === 'newest' ? 'desc' : 'asc',
      limit: 50,
    };

    // Only include categoryId if it's not "all-categories"
    if (selectedCategory !== 'all-categories') {
      params.categoryId = selectedCategory;
    }

    // Only include submittedByProfileId if filtering for "my" proposals and we have currentProfileId
    if (proposalFilter === 'my' && currentProfileId) {
      params.submittedByProfileId = currentProfileId;
    }

    return params;
  }, [
    instanceId,
    selectedCategory,
    proposalFilter,
    currentProfileId,
    sortOrder,
  ]);

  // If we're filtering for "my" proposals but don't have currentProfileId, show empty results
  const showEmptyResults = proposalFilter === 'my' && !currentProfileId;

  const [proposalsData] = trpc.decision.listProposals.useSuspenseQuery(
    queryParams,
  );

  // Override with empty results if we should show empty
  const finalProposalsData = showEmptyResults
    ? { proposals: [], total: 0, hasMore: false }
    : proposalsData;

  const { proposals } = finalProposalsData;

  return (
    <div className="mt-8">
      {/* Filters Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="text-lg font-medium text-neutral-charcoal">
            {proposalFilter === 'my'
              ? t('My proposals •')
              : t('All proposals •')}{' '}
            {proposals.length}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Select
            selectedKey={proposalFilter}
            onSelectionChange={(key) => {
              const newKey = String(key);
              // If selecting "My proposals" but no current profile, fallback to "all"
              if (newKey === 'my' && !currentProfileId) {
                return;
              }
              setProposalFilter(newKey);
            }}
          >
            <SelectItem id="all">{t('All proposals')}</SelectItem>
            <SelectItem id="my" isDisabled={!currentProfileId}>
              {t('My proposals')}
            </SelectItem>
          </Select>
          <Select
            selectedKey={selectedCategory}
            onSelectionChange={(key) => setSelectedCategory(String(key))}
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
          <Select
            selectedKey={sortOrder}
            onSelectionChange={(key) => setSortOrder(String(key))}
          >
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
