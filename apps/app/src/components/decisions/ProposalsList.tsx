'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Select, SelectItem } from '@op/ui/Select';
import { Skeleton } from '@op/ui/Skeleton';
import { useMemo, useState } from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { ProposalCard } from './ProposalCard';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalsListProps {
  slug: string;
  instanceId: string;
}

interface ProposalsProps {
  proposals: Proposal[] | undefined;
  instanceId: string;
  slug: string;
  isLoading: boolean;
  canManageProposals?: boolean;
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

const Proposals = ({
  proposals,
  instanceId,
  slug,
  isLoading,
  canManageProposals = false,
}: ProposalsProps) => {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  return !proposals || proposals.length === 0 ? (
    <NoProposalsFound />
  ) : (
    <div className="grid grid-cols-3 gap-6">
      {proposals.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          viewHref={`/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`}
          canManageProposals={canManageProposals}
        />
      ))}
    </div>
  );
};

export function ProposalsList({ slug, instanceId }: ProposalsListProps) {
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
      status?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
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

    // Filter by status if shortlisted proposals are selected
    if (proposalFilter === 'shortlisted') {
      params.status = 'approved';
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

  const { data: proposalsData, isLoading } =
    trpc.decision.listProposals.useQuery(queryParams);

  // Override with empty results if we should show empty
  const finalProposalsData = showEmptyResults
    ? { proposals: [], total: 0, hasMore: false, canManageProposals: false }
    : proposalsData;

  const { proposals, canManageProposals = false } = finalProposalsData ?? {};

  return (
    <div>
      {/* Filters Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-serif text-title-base text-neutral-black">
            {proposalFilter === 'my'
              ? t('My proposals •')
              : proposalFilter === 'shortlisted'
                ? t('Shortlisted proposals •')
                : t('All proposals •')}{' '}
            {proposals?.length ?? 0}
          </span>
        </div>
        <div className="grid max-w-fit grid-cols-2 justify-end gap-4 sm:flex sm:flex-1 sm:flex-wrap sm:items-center">
          <Select
            size="small"
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
            <SelectItem id="shortlisted">{t('Shortlisted')}</SelectItem>
            <SelectItem id="my" isDisabled={!currentProfileId}>
              {t('My proposals')}
            </SelectItem>
          </Select>
          <Select
            selectedKey={selectedCategory}
            size="small"
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
            size="small"
            onSelectionChange={(key) => setSortOrder(String(key))}
          >
            <SelectItem id="newest">{t('Newest First')}</SelectItem>
            <SelectItem id="oldest">{t('Oldest First')}</SelectItem>
          </Select>
        </div>
      </div>

      <Proposals
        isLoading={isLoading}
        proposals={proposals}
        instanceId={instanceId}
        slug={slug}
        canManageProposals={canManageProposals}
      />
    </div>
  );
}
