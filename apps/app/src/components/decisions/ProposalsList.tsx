'use client';

import { useUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { match } from '@op/core';
import { Button, ButtonLink } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { Header3 } from '@op/ui/Header';
import { Modal } from '@op/ui/Modal';
import { Select, SelectItem } from '@op/ui/Select';
import { Skeleton } from '@op/ui/Skeleton';
import { Surface } from '@op/ui/Surface';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { LuArrowDownToLine } from 'react-icons/lu';
import type { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

import { Bullet } from '../Bullet';
import { EmptyProposalsState } from './EmptyProposalsState';
import {
  ProposalCard,
  ProposalCardActions,
  ProposalCardContent,
  ProposalCardDescription,
  ProposalCardFooter,
  ProposalCardHeader,
  ProposalCardMenu,
  ProposalCardMeta,
  ProposalCardMetrics,
} from './ProposalCard';
import { VoteSubmissionModal } from './VoteSubmissionModal';
import { VoteSuccessModal } from './VoteSuccessModal';
import { VotingProposalCard } from './VotingProposalCard';
import { VotingSubmitFooter } from './VotingSubmitFooter';
import { useProposalExport } from './useProposalExport';
import { type ProposalFilter, useProposalFilters } from './useProposalFilters';

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

interface ProposalsProps {
  proposals?: Proposal[];
  instanceId: string;
  slug: string;
  isLoading: boolean;
  canManageProposals?: boolean;
  votedProposalIds?: string[];
}

const VotingProposalsList = ({
  proposals,
  instanceId,
  slug,
  canManageProposals = false,
  votedProposalIds = [],
}: ProposalsProps) => {
  const [selectedProposalIds, setSelectedProposalIds] = useState<string[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const t = useTranslations();

  const numSelected = selectedProposalIds.length;

  // Get voting status for this user and process
  const { data: voteStatus } = trpc.decision.getVotingStatus.useQuery({
    processInstanceId: instanceId,
  });

  const utils = trpc.useUtils();

  // Determine voting state
  const hasVoted = voteStatus?.hasVoted || false;
  const isReadOnly = hasVoted;
  const maxVotesPerMember =
    voteStatus?.votingConfiguration?.maxVotesPerMember || 0;

  // Handle proposal selection
  const toggleProposal = (proposalId: string) => {
    setSelectedProposalIds((prev) => {
      const isSelected = prev.includes(proposalId);

      if (isSelected) {
        // Remove from selection
        return prev.filter((id) => id !== proposalId);
      } else {
        // Add to selection if under limit
        if (prev.length < maxVotesPerMember) {
          return [...prev, proposalId];
        }
        return prev;
      }
    });
  };

  const isProposalSelected = (proposalId: string) =>
    selectedProposalIds.includes(proposalId);

  // Get selected proposals for the modal
  const selectedProposals =
    proposals?.filter((p) => selectedProposalIds.includes(p.id)) || [];

  // Handle successful vote submission
  const handleVoteSuccess = () => {
    setSelectedProposalIds([]);
    setShowSuccessModal(true); // Show success modal
    utils.decision.getVotingStatus.invalidate({
      processInstanceId: instanceId,
    });
  };

  if (!proposals || proposals.length === 0) {
    return <NoProposalsFound />;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {proposals.map((proposal) => {
          const isSelected = isProposalSelected(proposal.id);
          return (
            <VotingProposalCard
              key={proposal.id}
              proposalId={proposal.id}
              isVotingEnabled={true}
              isReadOnly={isReadOnly}
              isSelected={isSelected}
              isVotedFor={votedProposalIds.includes(proposal.id)}
              onToggle={toggleProposal}
            >
              <ProposalCardContent>
                <ProposalCardHeader
                  proposal={proposal}
                  menu={
                    (canManageProposals || proposal.isEditable || !isReadOnly) && (
                      <div className="flex items-center gap-2">
                        {(canManageProposals || proposal.isEditable) && (
                          <ProposalCardMenu
                            proposal={proposal}
                            canManage={canManageProposals}
                          />
                        )}
                        {!isReadOnly && (
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              isSelected={isSelected}
                              onChange={() => toggleProposal(proposal.id)}
                              shape="circle"
                              borderColor="light"
                              aria-label={
                                isSelected
                                  ? 'Deselect proposal'
                                  : 'Select proposal'
                              }
                            />
                          </div>
                        )}
                      </div>
                    )
                  }
                />
                <ProposalCardMeta withLink={false} proposal={proposal} />
                <ProposalCardDescription proposal={proposal} />
              </ProposalCardContent>
              <ProposalCardFooter>
                <ButtonLink
                  href={`/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`}
                  color="secondary"
                  className="w-full"
                >
                  {t('Read full proposal')}
                </ButtonLink>
              </ProposalCardFooter>
            </VotingProposalCard>
          );
        })}
      </div>

      <VotingSubmitFooter isVisible={!isReadOnly}>
        <div className="flex w-full items-center justify-between px-4 sm:max-w-6xl sm:px-8">
          <span className="text-neutral-black">
            <span className="text-primary-teal">{numSelected}</span> of{' '}
            {maxVotesPerMember}{' '}
            {maxVotesPerMember === 1 ? 'proposal' : 'proposals'} selected
          </span>

          <DialogTrigger>
            <Button isDisabled={numSelected === 0} variant="primary">
              {t('Submit my votes')}
            </Button>

            <Modal isDismissable>
              <Dialog className="h-full">
                <VoteSubmissionModal
                  selectedProposals={selectedProposals}
                  instanceId={instanceId}
                  maxVotes={maxVotesPerMember}
                  onSuccess={handleVoteSuccess}
                />
              </Dialog>
            </Modal>
          </DialogTrigger>
        </div>
      </VotingSubmitFooter>

      <VoteSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        instanceId={instanceId}
      />
    </>
  );
};

const ViewProposalsList = ({
  proposals,
  instanceId,
  slug,
  canManageProposals = false,
}: ProposalsProps) => {
  if (!proposals || proposals.length === 0) {
    return <NoProposalsFound />;
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {proposals.map((proposal) => (
        <ProposalCard key={proposal.id}>
          <div className="flex h-full flex-col justify-between gap-3 space-y-3">
            <ProposalCardContent>
              <ProposalCardHeader
                proposal={proposal}
                viewHref={`/profile/${slug}/decisions/${instanceId}/proposal/${proposal.profileId}`}
                menu={
                  (canManageProposals || proposal.isEditable) && (
                    <ProposalCardMenu
                      proposal={proposal}
                      canManage={canManageProposals}
                    />
                  )
                }
              />
              <ProposalCardMeta proposal={proposal} />
              <ProposalCardDescription proposal={proposal} />
            </ProposalCardContent>
          </div>
          <ProposalCardContent>
            <ProposalCardFooter>
              <ProposalCardMetrics proposal={proposal} />
              <ProposalCardActions proposal={proposal} />
            </ProposalCardFooter>
          </ProposalCardContent>
        </ProposalCard>
      ))}
    </div>
  );
};

const Proposals = (props: ProposalsProps) => {
  const { isLoading, instanceId } = props;

  // Get voting status for this user and process
  const { data: voteStatus } = trpc.decision.getVotingStatus.useQuery({
    processInstanceId: instanceId,
  });

  // Determine voting state
  const isVotingEnabled = !!voteStatus?.votingConfiguration?.allowDecisions;

  if (isLoading) {
    return <ProposalListSkeletonGrid />;
  }

  return match(isVotingEnabled, {
    true: () => <VotingProposalsList {...props} />,
    false: () => <ViewProposalsList {...props} />,
  });
};

export const ProposalsList = ({
  slug,
  instanceId,
}: {
  slug: string;
  instanceId: string;
}) => {
  const t = useTranslations();
  const { user } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Initialize state from URL search params
  const [selectedCategory, setSelectedCategory] = useState<string>(
    searchParams.get('category') || 'all-categories',
  );
  const [sortOrder, setSortOrder] = useState<string>(
    searchParams.get('sort') || 'newest',
  );

  // Get current user's profile ID for "My Proposals" filter
  const currentProfileId = user?.currentProfile?.id;
  const [[categoriesData, voteStatus]] = trpc.useSuspenseQueries((t) => [
    t.decision.getCategories({
      processInstanceId: instanceId,
    }),
    t.decision.getVotingStatus({
      processInstanceId: instanceId,
    }),
  ]);

  const categories = categoriesData.categories;

  // Determine if we're in ballot view (user has voted)
  const hasVoted = voteStatus?.hasVoted || false;
  const selectedProposalIds =
    voteStatus?.voteSubmission?.selectedProposalIds || [];

  // Export hook
  const {
    startExport,
    isExporting,
    isDownloadReady,
    downloadUrl,
    downloadFileName,
  } = useProposalExport();

  // Helper function to update URL params
  const updateURLParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === 'all-categories' || value === 'all') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const newUrl = `${pathname}?${params.toString()}`;
    router.replace(newUrl, { scroll: false });
  };

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

    return params;
  }, [instanceId, selectedCategory, sortOrder]);

  const { data: proposalsData, isLoading } =
    trpc.decision.listProposals.useQuery(queryParams);

  const { proposals: allProposals, canManageProposals = false } =
    proposalsData ?? {};

  // Use the custom hook for filtering proposals
  const {
    filteredProposals: proposals,
    proposalFilter,
    setProposalFilter,
  } = useProposalFilters({
    proposals: allProposals || [],
    currentProfileId,
    votedProposalIds: selectedProposalIds,
    hasVoted,
    initialFilter: (searchParams.get('filter') as ProposalFilter) || undefined,
  });

  // Sync URL with filter changes (both manual and automatic)
  useEffect(() => {
    const currentFilter = searchParams.get('filter');
    if (proposalFilter !== currentFilter) {
      updateURLParams({ filter: proposalFilter });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalFilter]);

  // Handle export
  const handleExport = () => {
    startExport(
      {
        processInstanceId: instanceId,
        categoryId:
          selectedCategory !== 'all-categories' ? selectedCategory : undefined,
        dir: sortOrder === 'newest' ? 'desc' : 'asc',
        proposalFilter,
      },
      'csv',
    );
  };

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="font-serif text-title-base text-neutral-black">
            {proposalFilter === 'my-ballot'
              ? t('My ballot')
              : proposalFilter === 'my'
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
              const newKey = key as ProposalFilter;
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
            {hasVoted && (
              <SelectItem id="my-ballot">{t('My ballot')}</SelectItem>
            )}
          </Select>
          <Select
            selectedKey={selectedCategory}
            size="small"
            className="min-w-36"
            onSelectionChange={(key) => {
              const category = String(key);
              setSelectedCategory(category);
              updateURLParams({ category });
            }}
            aria-label={t('Filter proposals by category')}
          >
            <SelectItem
              id="all-categories"
              aria-label={t('Show all categories')}
            >
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
            onSelectionChange={(key) => {
              const sort = String(key);
              setSortOrder(sort);
              updateURLParams({ sort });
            }}
          >
            <SelectItem id="newest">{t('Newest First')}</SelectItem>
            <SelectItem id="oldest">{t('Oldest First')}</SelectItem>
          </Select>
          {canManageProposals ? (
            isDownloadReady && downloadUrl ? (
              <ButtonLink
                href={downloadUrl}
                download={downloadFileName}
                color="secondary"
                size="small"
              >
                <LuArrowDownToLine className="size-4 stroke-[1.5]" />
                {t('Click to download')}
              </ButtonLink>
            ) : (
              <Button
                onPress={handleExport}
                isDisabled={isExporting}
                color="secondary"
                size="small"
              >
                <LuArrowDownToLine className="size-4 stroke-[1.5]" />
                {isExporting ? t('Exporting...') : t('Export')}
              </Button>
            )
          ) : null}
        </div>
      </div>

      <Proposals
        isLoading={isLoading}
        proposals={proposals}
        instanceId={instanceId}
        slug={slug}
        canManageProposals={canManageProposals}
        votedProposalIds={selectedProposalIds}
      />
    </div>
  );
};
