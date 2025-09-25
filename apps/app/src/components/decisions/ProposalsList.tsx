'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Header3 } from '@op/ui/Header';
import { Select, SelectItem } from '@op/ui/Select';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { useMemo, useState } from 'react';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { EmptyProposalsState } from './EmptyProposalsState';
import { ProposalCard } from './ProposalCard';

type Proposal = z.infer<typeof proposalEncoder>;

const ProposalCardSkeleton = () => {
  return (
    <Surface className="relative w-full min-w-80 space-y-3 p-4 pb-4">
      {/* Header with title and budget skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>

      {/* Author and category skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="size-6 rounded-full" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-1 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* Description skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Footer with engagement skeleton */}
      <div className="flex flex-col justify-between gap-4">
        <div className="flex w-full items-center justify-between gap-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
    </Surface>
  );
};

{
  /* Proposals Grid Skeleton */
}
export const ProposalListSkeletonGrid = () => (
  <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, index) => (
      <ProposalCardSkeleton key={index} />
    ))}
  </div>
);

export const ProposalListSkeleton = () => {
  return (
    <div className="flex flex-col gap-6">
      {/* Filters Bar Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="grid max-w-fit grid-cols-2 justify-end gap-4 sm:flex sm:flex-1 sm:flex-wrap sm:items-center">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      <ProposalListSkeletonGrid />
    </div>
  );
};

const NoProposalsFound = () => {
  const t = useTranslations();
  return (
    <EmptyProposalsState>
      <Header3 className="font-serif !text-title-base font-light text-neutral-black">
        {t('No proposals found matching the current filters.')}
      </Header3>
      <p className="text-base text-neutral-charcoal">
        {t('Try adjusting your filter selection above.')}
      </p>
    </EmptyProposalsState>
  );
};

const Proposals = ({
  proposals,
  instanceId,
  slug,
  isLoading,
  canManageProposals = false,
}: {
  proposals?: Proposal[];
  instanceId: string;
  slug: string;
  isLoading: boolean;
  canManageProposals?: boolean;
}) => {
  if (isLoading) {
    return <ProposalListSkeletonGrid />;
  }

  return !proposals || proposals.length === 0 ? (
    <NoProposalsFound />
  ) : (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
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

export function ProposalsList({
  slug,
  instanceId,
}: {
  slug: string;
  instanceId: string;
}) {
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
    <div className="flex flex-col gap-6">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-serif text-title-base text-neutral-black">
            {proposalFilter === 'my'
              ? t('My proposals')
              : proposalFilter === 'shortlisted'
                ? t('Shortlisted proposals')
                : t('All proposals')}{' '}
            <Bullet /> {proposals?.length ?? 0}
          </span>
        </div>
        <div className="grid max-w-fit grid-cols-2 justify-end gap-4 sm:flex sm:flex-1 sm:flex-wrap sm:items-center">
          <Select
            size="small"
            className="min-w-36"
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
            className="min-w-36"
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
            className="min-w-32"
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
